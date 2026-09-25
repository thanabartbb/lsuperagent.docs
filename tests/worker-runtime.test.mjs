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

test('research forces web_search and returns normalized sources', async () => {
  await withFetchStub(async (_url, init) => {
    const payload = JSON.parse(init.body);
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
    const response = await worker.fetch(await request('/api/chat', { message: 'ค้นคว้าเรื่องนี้', mode: 'research', tool: 'research' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.sources, [
      { title: 'Source A', url: 'https://example.com/a' },
      { title: 'Source B', url: 'https://example.com/b' }
    ]);
  });
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
  await withFetchStub(async () => jsonResponse({ output_text: 'ok' }), async () => {
    const message = 'x'.repeat(30001);
    const response = await worker.fetch(await request('/api/chat', { message, mode: 'code', tool: 'code' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
  });
});

test('root opens the login entry when no session exists', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/'), {});
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get('location'), 'https://agents-sdk.space').pathname, '/login');
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

  const chat = await worker.fetch(new Request('https://agents-sdk.space/chat', { headers: { cookie } }), {
    ...env, ASSETS: { fetch: async () => new Response('<!doctype html><title>Chat</title>', { headers: { 'content-type': 'text/html' } }) },
  });
  assert.equal(chat.status, 200);
});

test('AI APIs reject requests without a signed user session', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/api/chat', { method: 'POST' }), { OPENAI_API_KEY: 'test-key', AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'authentication_required');
});
