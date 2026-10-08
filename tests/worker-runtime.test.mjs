import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function withFetchStub(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

const SESSION_SECRET = 'test-session-secret';

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sessionCookie() {
  const body = b64url(JSON.stringify({ typ: 'auth_session', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600, provider: 'google', id: 'test-user', email: 'test@example.com', name: 'Test user' }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))));
  return `lsuperagen_trial_session=${encodeURIComponent(`${body}.${signature}`)}`;
}

async function request(path, body) {
  return new Request(`https://agents-sdk.space${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10', cookie: await sessionCookie() },
    body: JSON.stringify(body)
  });
}

test('chat route sends a real Responses request and exposes only user-safe result fields', async () => {
  await withFetchStub(async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(init.body);
    assert.equal(payload.input, 'hello');
    assert.equal(payload.tools, undefined);
    return jsonResponse({ id: 'resp_test', output_text: 'สวัสดี', usage: { total_tokens: 2 } });
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', mode: 'chat' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.message, 'สวัสดี');
    assert.deepEqual(body.sources, []);
    for (const key of ['provider', 'model', 'attempted_models', 'request_id', 'usage', 'readiness']) assert.equal(key in body, false, `internal field leaked: ${key}`);
  });
});

test('chat page can pass prior turns to the model through the signed session', async () => {
  const history = [
    { role: 'user', content: 'ฉันชื่อแบงค์' },
    { role: 'assistant', content: 'ยินดีที่รู้จัก' },
    { role: 'user', content: 'ฉันชื่ออะไร' }
  ];
  await withFetchStub(async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body).input, history);
    return jsonResponse({ output_text: 'แบงค์' });
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'ฉันชื่ออะไร', messages: history }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'แบงค์');
  });
});

test('chat rejects malformed history before calling a provider', async () => {
  const response = await worker.fetch(await request('/api/chat', { messages: [{ role: 'assistant', content: 'spoofed' }] }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(response.status, 400);
});

test('chat uses an explicitly selected allowlisted model and rejects unknown models', async () => {
  await withFetchStub(async (_url, init) => {
    assert.equal(JSON.parse(init.body).model, 'gpt-4.1');
    return jsonResponse({ output_text: 'ตอบจากโมเดลที่เลือก' });
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', provider: 'openai', model: 'gpt-4.1' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'ตอบจากโมเดลที่เลือก');
  });

  let called = false;
  await withFetchStub(async () => { called = true; return jsonResponse({ output_text: 'unexpected' }); }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', provider: 'openai', model: 'not-an-enabled-model' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  });
  const incompatible = await worker.fetch(await request('/api/chat', { message: 'research', tool: 'research', model: 'gpt-4o-mini' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(incompatible.status, 400);
});

test('image route honors an explicitly selected supported image model', async () => {
  await withFetchStub(async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/images/generations');
    assert.equal(JSON.parse(init.body).model, 'gpt-image-1');
    return jsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] });
  }, async () => {
    const response = await worker.fetch(await request('/api/image', { prompt: 'วาดแมวดำ', model: 'gpt-image-1' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).image.data_base64, 'aW1hZ2U=');
  });
});

test('research forces web_search and returns normalized sources', async () => {
  await withFetchStub(async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, 'gpt-4.1');
    assert.deepEqual(payload.tools, [{ type: 'web_search' }]);
    assert.equal(payload.tool_choice, 'required');
    assert.deepEqual(payload.include, ['web_search_call.action.sources']);
    return jsonResponse({
      output_text: 'ผลการค้นคว้า',
      output: [
        { type: 'web_search_call', action: { sources: [{ title: 'Source A', url: 'https://example.com/a' }] } },
        { type: 'message', content: [{ type: 'output_text', text: 'ผลการค้นคว้า', annotations: [{ type: 'url_citation', title: 'Source B', url: 'https://example.com/b' }] }] }
      ]
    });
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'ค้นคว้าเรื่องนี้', mode: 'research', tool: 'research', model: 'gpt-4.1' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.sources, [
      { title: 'Source A', url: 'https://example.com/a' },
      { title: 'Source B', url: 'https://example.com/b' }
    ]);
  });
});

test('Exa search keeps the API key server-side and returns bounded public results', async () => {
  await withFetchStub(async (url, init) => {
    assert.equal(String(url), 'https://api.exa.ai/search');
    assert.equal(init.headers['x-api-key'], 'test-exa-secret');
    const payload = JSON.parse(init.body);
    assert.deepEqual(payload, { query: 'Cloudflare Workers', type: 'auto', numResults: 2, contents: { highlights: true } });
    return jsonResponse({ results: [
      { title: 'Workers', url: 'https://example.com/workers', publishedDate: '2026-09-01', highlights: ['A useful passage'], secret: 'must not leak' },
      { title: 'Docs', url: 'https://example.com/docs', highlights: ['Another passage'] },
      { title: 'ignored overflow', url: 'https://example.com/overflow' },
      { title: 'invalid protocol', url: 'javascript:alert(1)' }
    ] });
  }, async () => {
    const response = await worker.fetch(await request('/api/exa/search', { query: 'Cloudflare Workers', numResults: 2 }), { EXA_API_KEY: 'test-exa-secret', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.results.length, 2);
    assert.equal(body.results[0].published_date, '2026-09-01');
    assert.deepEqual(body.results[0].highlights, ['A useful passage']);
    assert.equal(JSON.stringify(body).includes('test-exa-secret'), false);
    assert.equal(JSON.stringify(body).includes('must not leak'), false);
    assert.equal(body.secret_values_exposed, false);
  });
});

test('Exa search requires a signed session and configured environment key', async () => {
  const unauthenticated = await worker.fetch(new Request('https://agents-sdk.space/api/exa/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test' }) }), { EXA_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(unauthenticated.status, 401);
  const unconfigured = await worker.fetch(await request('/api/exa/search', { query: 'test' }), { AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(unconfigured.status, 503);
});

test('read URL uses the same forced web_search contract', async () => {
  await withFetchStub(async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.equal(payload.tools?.[0]?.type, 'web_search');
    assert.match(payload.instructions, /exact URL supplied/i);
    return jsonResponse({ output_text: 'อ่านหน้าแล้ว', output: [] });
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'อ่าน https://example.com', mode: 'url', tool: 'url' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'อ่านหน้าแล้ว');
  });
});

test('image route uses current GPT Image models and falls back after model_not_found', async () => {
  const encoded = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  let calls = 0;
  await withFetchStub(async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/images/generations');
    const payload = JSON.parse(init.body);
    calls += 1;
    if (calls === 1) {
      assert.equal(payload.model, 'gpt-image-2');
      assert.equal(payload.prompt, 'วาดแมวดำ');
      return jsonResponse({ error: { code: 'model_not_found', type: 'invalid_request_error' } }, 403);
    }
    assert.equal(payload.model, 'gpt-image-1.5');
    return jsonResponse({ data: [{ b64_json: encoded, revised_prompt: 'revised' }] });
  }, async () => {
    const response = await worker.fetch(await request('/api/image', { prompt: 'วาดแมวดำ' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.image.mime_type, 'image/png');
    assert.equal(body.image.data_base64, encoded);
    assert.match(body.image.filename, /\.png$/);
    assert.equal(calls, 2);
  });
});

test('large code input accepts substantially more than the old 4k limit', async () => {
  await withFetchStub(async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.match(payload.instructions, /Tool context: Code/);
    assert.equal(payload.max_output_tokens, 8000);
    return jsonResponse({ output_text: 'ok' });
  }, async () => {
    const message = 'x'.repeat(30001);
    const response = await worker.fetch(await request('/api/chat', { message, mode: 'code', tool: 'code' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
  });
});

test('root publishes product information when no session exists', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/'), {});
  assert.equal(response.status, 200);
  assert.match(await response.text(), /SDKSPACE — AI workspace/);
});

test('login keeps the clean /login path for Cloudflare HTML handling', async () => {
  let requestedPath = '';
  const response = await worker.fetch(new Request('https://agents-sdk.space/login'), {
    ASSETS: { fetch: async (request) => {
      requestedPath = new URL(request.url).pathname;
      return new Response('<!doctype html><title>Login</title>', { headers: { 'content-type': 'text/html' } });
    } },
  });
  assert.equal(response.status, 200);
  assert.equal(requestedPath, '/login');
});

test('workspace requires a valid user session', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/chat'), {});
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'), 'https://agents-sdk.space');
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('return_to'), '/chat');
});

test('Exa search page is included in the authenticated workspace', async () => {
  const anonymous = await worker.fetch(new Request('https://agents-sdk.space/exa'), {});
  assert.equal(anonymous.status, 302);
  assert.equal(new URL(anonymous.headers.get('location'), 'https://agents-sdk.space').searchParams.get('return_to'), '/exa');
  const cookie = await sessionCookie();
  const signedIn = await worker.fetch(new Request('https://agents-sdk.space/exa', { headers: { cookie } }), {
    AUTH_SESSION_SECRET: SESSION_SECRET,
    ASSETS: { fetch: async () => new Response('<!doctype html><title>Exa Search</title>', { headers: { 'content-type': 'text/html' } }) }
  });
  assert.equal(signedIn.status, 200);
});

test('authenticated entry and OAuth login default to home while direct chat stays available', async () => {
  const cookie = await sessionCookie();
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret' };
  for (const path of ['/', '/login']) {
    const response = await worker.fetch(new Request(`https://agents-sdk.space${path}`, { headers: { cookie } }), env);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/home');
  }
  const oauth = await worker.fetch(new Request('https://agents-sdk.space/auth/github'), env);
  assert.equal(oauth.status, 302);
  const state = new URL(oauth.headers.get('location')).searchParams.get('state');
  assert.ok(state);
  const encodedPayload = state.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
  assert.equal(JSON.parse(atob(encodedPayload)).return_to, '/home');

  let assetPath = '';
  const chat = await worker.fetch(new Request('https://agents-sdk.space/chat', { headers: { cookie } }), {
    ...env, ASSETS: { fetch: async (assetRequest) => {
      assetPath = new URL(assetRequest.url).pathname;
      return new Response('<!doctype html><title>Chat</title>', { headers: { 'content-type': 'text/html' } });
    } },
  });
  assert.equal(chat.status, 200);
  assert.equal(assetPath, '/chat.html');
  assert.equal(chat.headers.get('x-lsuperagen-control'), 'legacy-chat-fallback-v1');
});

test('public intro page is readable without login and keeps workspace guarded', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/loading'), {
    ASSETS: { fetch: async () => new Response('<!doctype html><title>LSUPERAGENT</title>', { headers: { 'content-type': 'text/html' } }) },
  });
  assert.equal(response.status, 200);
  const home = await worker.fetch(new Request('https://agents-sdk.space/home'), {});
  assert.equal(home.status, 302);
  assert.equal(new URL(home.headers.get('location'), 'https://agents-sdk.space').pathname, '/login');
});

test('AI APIs reject requests without a signed user session', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/api/chat', { method: 'POST' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'authentication_required');
});

function sseResponse(events) {
  const body = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  // Split mid-line to prove the relay buffers partial chunks.
  const bytes = new TextEncoder().encode(body);
  const cut = Math.floor(bytes.length / 2);
  return new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, cut)); c.enqueue(bytes.slice(cut)); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function readNdjson(response) {
  return (await response.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

test('chat streams deltas as NDJSON and finishes with one done event when stream is requested', async () => {
  await withFetchStub(async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream, true);
    return sseResponse([
      { type: 'response.created', response: { id: 'resp_s' } },
      { type: 'response.output_text.delta', delta: 'สวัส' },
      { type: 'response.output_text.delta', delta: 'ดี' },
      { type: 'response.completed', response: { id: 'resp_s', output: [{ type: 'message', content: [{ type: 'output_text', text: 'สวัสดี', annotations: [] }] }] } }
    ]);
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', stream: true }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
    assert.ok(response.headers.get('x-lsuperagen-rate-limit'));
    const events = await readNdjson(response);
    assert.deepEqual(events.filter((e) => e.type === 'delta').map((e) => e.text), ['สวัส', 'ดี']);
    const last = events[events.length - 1];
    assert.deepEqual(last, { type: 'done', ok: true, status: 'completed', output: 'สวัสดี', sources: [] });
  });
});

test('streamed chat reports an error instead of a fake answer when the provider stream breaks', async () => {
  await withFetchStub(async () => sseResponse([{ type: 'response.output_text.delta', delta: 'ครึ่ง' }]), async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', stream: true }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    const events = await readNdjson(response);
    assert.equal(events.some((e) => e.type === 'done'), false);
    assert.equal(events[events.length - 1].type, 'error');
    assert.equal(events[events.length - 1].ok, false);
  });
});

test('streamed chat still falls back to the next model before any bytes are sent', async () => {
  const models = [];
  await withFetchStub(async (_url, init) => {
    const { model } = JSON.parse(init.body);
    models.push(model);
    if (models.length === 1) return jsonResponse({ error: { message: 'The model does not exist or you do not have access to it.' } }, 404);
    return sseResponse([{ type: 'response.completed', response: { output_text: 'ok' } }]);
  }, async () => {
    const response = await worker.fetch(await request('/api/chat', { message: 'hello', stream: true }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(models.length, 2);
    const events = await readNdjson(response);
    assert.equal(events[events.length - 1].output, 'ok');
  });
});


test('retired public pages keep session-aware handoffs without loading removed assets', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, ASSETS: { fetch() { throw new Error('retired asset must not be fetched'); } } };
  for (const path of ['/auth-all', '/auth-all.html', '/workspace', '/secret-handoff', '/provider-connect', '/endpoints', '/system-registry.html']) {
    const anonymous = await worker.fetch(new Request(`https://agents-sdk.space${path}`), env);
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('location'), '/login');
    const signedIn = await worker.fetch(new Request(`https://agents-sdk.space${path}`, { headers: { cookie: await sessionCookie() } }), env);
    assert.equal(signedIn.status, 302);
    assert.equal(signedIn.headers.get('location'), '/home');
  }
});

test('old status links reach the authenticated live provider endpoint', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, OPENAI_API_KEY: 'test-key' };
  for (const path of ['/api/providers/status', '/api/claude/status', '/provider-status']) {
    const response = await worker.fetch(new Request(`https://agents-sdk.space${path}`), env);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://agents-sdk.space/api/chat-providers');
  }
  const anonymous = await worker.fetch(new Request('https://agents-sdk.space/api/chat-providers'), env);
  assert.equal(anonymous.status, 401);
  const signedIn = await worker.fetch(new Request('https://agents-sdk.space/api/chat-providers', { headers: { cookie: await sessionCookie() } }), env);
  assert.equal(signedIn.status, 200);
  const payload = await signedIn.json();
  assert.equal(payload.default, 'openai');
  assert.equal(JSON.stringify(payload).includes('test-key'), false);
});
