import { DurableObject } from 'cloudflare:workers';
import { verifyWebhook } from './webhook.js';

const OPENAI_BASE = 'https://api.openai.com/v1/agents';
const ID = /^sess_[A-Za-z0-9_-]{4,128}$/;
const ENVIRONMENT = /^[A-Za-z0-9_-]{5,180}$/;
const MAX_BODY = 128 * 1024;
const INACTIVITY_MS = 10 * 60 * 1000;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function equalConstantTime(a, b) {
  const first = new TextEncoder().encode(String(a || ''));
  const second = new TextEncoder().encode(String(b || ''));
  let diff = first.length ^ second.length;
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    diff |= (first[i] || 0) ^ (second[i] || 0);
  }
  return diff === 0;
}

// One Durable Object (and at most one Container) per OpenAI session.
export class ExecutorSandbox extends DurableObject {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/start' && request.method === 'POST') {
      const input = await request.json();
      const environmentId = input.environment_id;
      const remote = input.remote_url;
      if (!ENVIRONMENT.test(environmentId) || typeof remote !== 'string') {
        return reply({ error: 'invalid_environment' }, 400);
      }
      let endpoint;
      try { endpoint = new URL(remote); } catch (_) { return reply({ error: 'invalid_remote' }, 400); }
      // Preserve the URL exactly when passed to Codex. Never accept an arbitrary host.
      if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'api.openai.com'
          || endpoint.username || endpoint.password) {
        return reply({ error: 'remote_not_allowed' }, 400);
      }
      const container = this.ctx.container;
      if (!container) return reply({ error: 'container_not_configured' }, 503);
      const previous = await this.ctx.storage.get('environment_id');
      if (container.running && previous === environmentId) {
        await container.setInactivityTimeout(INACTIVITY_MS);
        return reply({ ok: true, reused: true });
      }
      if (container.running) await container.destroy();
      // The executor key alone cannot create agents or infer with the main API.
      container.start({
        entrypoint: ['codex', 'exec-server', '--remote', remote, '--environment-id', environmentId],
        env: { CODEX_API_KEY: this.env.OPENAI_EXECUTOR_API_KEY },
        enableInternet: true
      });
      await this.ctx.storage.put('environment_id', environmentId);
      await container.setInactivityTimeout(INACTIVITY_MS);
      return reply({ ok: true, reused: false });
    }
    if (path === '/stop' && request.method === 'POST') {
      if (this.ctx.container?.running) await this.ctx.container.destroy();
      await this.ctx.storage.delete('environment_id');
      return reply({ ok: true });
    }
    return reply({ error: 'not_found' }, 404);
  }
}

async function retrieveSession(env, sessionId) {
  const response = await fetch(OPENAI_BASE + '/sessions/' + encodeURIComponent(sessionId), {
    headers: {
      authorization: 'Bearer ' + env.OPENAI_API_KEY,
      'openai-beta': 'agents=v1'
    },
    redirect: 'error'
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('session_retrieval_failed_' + response.status);
  return response.json();
}

function executor(env, id) {
  return env.EXECUTOR.get(env.EXECUTOR.idFromName(id));
}

async function stop(env, id) {
  return executor(env, id).fetch(new Request('https://internal/stop', { method: 'POST' }));
}

async function handleEvent(body, env) {
  const id = body?.data?.id;
  if (!ID.test(id || '') || !/^agent\.session\./.test(body?.type || '')) return reply({ error: 'unsupported_event' }, 400);
  const session = await retrieveSession(env, id);
  if (!session) {
    await stop(env, id);
    return reply({ ok: true, stopped: true });
  }
  const configuredAgent = String(env.OPENAI_AGENT_ID || '');
  const actualAgent = String(session.agent_id || session.agent?.id || '');
  if (!configuredAgent || actualAgent !== configuredAgent) return reply({ error: 'agent_not_allowed' }, 403);
  if (session.environment?.type !== 'self_hosted') return reply({ ok: true, ignored: true });
  if (body.type === 'agent.session.failed' || session.status === 'failed') {
    await stop(env, id);
    return reply({ ok: true, stopped: true });
  }
  // Ignore idle unless a container is already running. Cloudflare stops inactive containers.
  if (body.type === 'agent.session.idle') return reply({ ok: true, idle: true });
  const environmentId = session.environment?.id;
  const remote = session.environment?.remote_url;
  if (!environmentId || !remote) return reply({ ok: true, awaiting_environment: true }, 202);
  const started = await executor(env, id).fetch(new Request('https://internal/start', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ environment_id: environmentId, remote_url: remote })
  }));
  return reply({ ok: started.ok }, started.ok ? 200 : 503);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') {
      return reply({
        ok: true,
        configured: Boolean(env.OPENAI_API_KEY && env.OPENAI_EXECUTOR_API_KEY && env.OPENAI_AGENT_ID),
        webhook_configured: Boolean(env.OPENAI_WEBHOOK_SECRET?.startsWith('whsec_'))
      });
    }
    if (path === '/webhook' && request.method === 'POST') {
      if (!env.OPENAI_WEBHOOK_SECRET || !env.OPENAI_API_KEY || !env.OPENAI_AGENT_ID
          || !env.OPENAI_EXECUTOR_API_KEY) return reply({ error: 'not_configured' }, 503);
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return reply({ error: 'too_large' }, 413);
      const raw = await request.text();
      if (raw.length > MAX_BODY) return reply({ error: 'too_large' }, 413);
      if (!(await verifyWebhook(raw, request.headers, env.OPENAI_WEBHOOK_SECRET))) {
        return reply({ error: 'invalid_webhook_signature' }, 401);
      }
      let payload;
      try { payload = JSON.parse(raw); } catch (_) { return reply({ error: 'invalid_json' }, 400); }
      try { return await handleEvent(payload, env); }
      catch (_) { return reply({ error: 'provisioning_failed' }, 503); }
    }
    const match = /^\/executors\/(sess_[A-Za-z0-9_-]{4,128})$/.exec(path);
    if (match && request.method === 'DELETE') {
      if (!env.EXECUTOR_CLIENT_SECRET || !equalConstantTime(
        request.headers.get('authorization'), 'Bearer ' + env.EXECUTOR_CLIENT_SECRET
      )) return reply({ error: 'unauthorized' }, 401);
      try { await stop(env, match[1]); return reply({ ok: true, stopped: true }); }
      catch (_) { return reply({ error: 'cleanup_failed' }, 503); }
    }
    return reply({ error: 'not_found' }, 404);
  }
};
