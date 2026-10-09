// SDKSPACE private, owner-gated OpenAI Agents API bridge. No browser credentials.
// Rollout is opt-in; existing /chat and /api/chat remain untouched.
import { userKey } from './chat-store.js';

const BASE = 'https://api.openai.com/v1/agents';
const SESSION_ID = /^sess_[A-Za-z0-9_-]{4,128}$/;
const MAX_MESSAGE = 12000;

function result(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function allowedOwner(session, env) {
  if (session?.provider !== 'google') return false;
  const emails = new Set(String(env.OWNER_GOOGLE_EMAIL || '').toLowerCase().split(/[\s,]+/).filter(Boolean));
  const subs = new Set(String(env.OWNER_GOOGLE_SUB || '').toLowerCase().split(/[\s,]+/).filter(Boolean));
  return (emails.size > 0 && emails.has(String(session.email || '').toLowerCase()))
    || (subs.size > 0 && subs.has(String(session.id || session.sub || '').toLowerCase()));
}

function unsafeRequest(request) {
  if (!['POST', 'DELETE'].includes(request.method)) return false;
  const origin = request.headers.get('origin');
  return origin !== new URL(request.url).origin
    || !String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json');
}

async function providerRequest(env, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', 'Bearer ' + env.OPENAI_API_KEY);
  headers.set('openai-beta', 'agents=v1');
  headers.set('accept', init.stream ? 'text/event-stream' : 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  return fetch(BASE + path, {
    method: init.method || 'GET', headers, body: init.body && JSON.stringify(init.body),
    redirect: 'error'
  });
}

async function providerJson(env, path, init = {}) {
  const response = await providerRequest(env, path, init);
  if (!response.ok) {
    // Do not relay API error bodies, which can contain request details.
    return { error: result({ ok: false, error: 'agents_upstream_error', upstream_status: response.status }, 502) };
  }
  return { data: await response.json() };
}

async function parseBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 14000) return null;
  try {
    const text = await request.text();
    return text.length <= 14000 ? JSON.parse(text) : null;
  } catch (_) { return null; }
}

export async function handleSandboxApi(request, env, session) {
  if (!session) return result({ ok: false, error: 'authentication_required' }, 401);
  // Explicit opt-in and owner-only rollout even if the API key exists.
  if (env.SANDBOX_ENABLED !== 'true' || !allowedOwner(session, env)) {
    return result({ ok: false, error: 'sandbox_not_enabled' }, 403);
  }
  if (!env.DB?.prepare || !env.OPENAI_API_KEY || !env.OPENAI_AGENT_ID) {
    return result({ ok: false, error: 'sandbox_not_configured' }, 503);
  }
  if (unsafeRequest(request)) return result({ ok: false, error: 'origin_or_content_type_invalid' }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const owner = userKey(session);
  const collection = path === '/api/sandbox/sessions';
  const match = /^\/api\/sandbox\/sessions\/(sess_[A-Za-z0-9_-]{4,128})(?:\/(messages|events|items|cancel))?$/.exec(path);
  if (!collection && !match) return result({ ok: false, error: 'not_found' }, 404);
  if (collection && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT session_id, created_at FROM sandbox_sessions WHERE user_key = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(owner).all();
    return result({ ok: true, sessions: results || [] });
  }
  if (collection && request.method === 'POST') {
    const body = await parseBody(request);
    if (!body || Object.keys(body).length > 0) return result({ ok: false, error: 'expected_empty_object' }, 400);
    // No input on create: persist ownership before a later, separate message starts work.
    let created;
    try {
      const upstream = await providerJson(env, '/sessions', {
        method: 'POST', body: {
          agent_id: env.OPENAI_AGENT_ID,
          environment: { type: 'self_hosted', workspace_directory: '/workspace' }
        }
      });
      if (upstream.error) return upstream.error;
      created = upstream.data;
      if (!SESSION_ID.test(created?.id) || created?.environment?.type !== 'self_hosted') {
        return result({ ok: false, error: 'unexpected_agents_response' }, 502);
      }
      await env.DB.prepare(
        'INSERT INTO sandbox_sessions (session_id, user_key, created_at) VALUES (?, ?, ?)'
      ).bind(created.id, owner, Date.now()).run();
      return result({ ok: true, session_id: created.id, status: created.status || 'pending' }, 201);
    } catch (_) {
      // Persist failure can orphan a provider session; best effort cleanup.
      if (SESSION_ID.test(created?.id || '')) {
        try { await providerRequest(env, '/sessions/' + encodeURIComponent(created.id), { method: 'DELETE' }); } catch (_) {}
      }
      return result({ ok: false, error: 'sandbox_create_failed' }, 503);
    }
  }
  if (!match) return result({ ok: false, error: 'method_not_allowed' }, 405);
  const id = match[1], action = match[2] || '';
  const owned = await env.DB.prepare(
    'SELECT session_id FROM sandbox_sessions WHERE session_id = ? AND user_key = ?'
  ).bind(id, owner).first();
  if (!owned) return result({ ok: false, error: 'not_found' }, 404);

  try {
    if (!action && request.method === 'GET') {
      const out = await providerJson(env, '/sessions/' + encodeURIComponent(id));
      if (out.error) return out.error;
      return result({ ok: true, session_id: id, status: out.data.status, environment_status: out.data.environment?.status || null });
    }
    if (action === 'items' && request.method === 'GET') {
      const out = await providerJson(env, '/sessions/' + encodeURIComponent(id) + '/items?order=asc&limit=100');
      if (out.error) return out.error;
      return result({ ok: true, items: out.data.data || [] });
    }
    if (action === 'events' && request.method === 'GET') {
      const upstream = await providerRequest(env, '/sessions/' + encodeURIComponent(id) + '/events?stream=true', { stream: true });
      if (!upstream.ok || !upstream.body) {
        return result({ ok: false, error: 'agent_stream_unavailable', upstream_status: upstream.status }, 502);
      }
      // Stream directly from OpenAI; no API credentials or request headers reach the browser.
      return new Response(upstream.body, { status: 200, headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-store',
        'x-content-type-options': 'nosniff'
      } });
    }
    if (action === 'messages' && request.method === 'POST') {
      const body = await parseBody(request);
      if (typeof body?.message !== 'string' || body.message.trim().length < 1
          || body.message.length > MAX_MESSAGE) {
        return result({ ok: false, error: 'invalid_message' }, 400);
      }
      const key = request.headers.get('idempotency-key') || '';
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) {
        return result({ ok: false, error: 'idempotency_key_required' }, 400);
      }
      const out = await providerJson(env, '/sessions/' + encodeURIComponent(id) + '/events', {
        method: 'POST', headers: { 'idempotency-key': key },
        body: { events: [{ type: 'agent.session.input.message', input: [
          { role: 'user', content: [{ type: 'input_text', text: body.message.trim() }] }
        ] }] }
      });
      if (out.error) return out.error;
      return result({ ok: true, session_id: id, accepted: true });
    }
    if (action === 'cancel' && request.method === 'POST') {
      const body = await parseBody(request);
      if (!body || Object.keys(body).length > 0) return result({ ok: false, error: 'expected_empty_object' }, 400);
      const out = await providerJson(env, '/sessions/' + encodeURIComponent(id) + '/events', {
        method: 'POST', body: { events: [{ type: 'agent.session.input.cancel' }] }
      });
      if (out.error) return out.error;
      return result({ ok: true, cancellation_requested: true });
    }
    return result({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (_) {
    return result({ ok: false, error: 'sandbox_upstream_unavailable' }, 503);
  }
}
