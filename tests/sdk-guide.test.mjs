import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';
import { Lsupergen, APIError, VERSION } from '../vendor/lsupergen-sdk/0.1.0/index.js';

const SESSION_SECRET = 'test-session-secret';
const ORIGIN = 'https://agents-sdk.space';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url));

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signedSession() {
  const body = b64url(JSON.stringify({ typ: 'auth_session', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600, provider: 'google', id: 'test-user', email: 'test@example.com', name: 'Test user' }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))));
  return `${body}.${signature}`;
}

async function sessionCookie() {
  return `lsuperagen_trial_session=${encodeURIComponent(await signedSession())}`;
}

// Routes the real SDK's fetch calls into the Worker, exactly as a deployed request would arrive.
function sdkClient(apiKey, env, options = {}) {
  return new Lsupergen({
    apiKey,
    baseURL: `${ORIGIN}/v1`,
    maxRetries: 0,
    fetch: (url, init) => worker.fetch(new Request(url, { ...init, headers: { ...init.headers, 'cf-connecting-ip': '198.51.100.7' } }), env),
    ...options
  });
}

async function createKey(env) {
  const response = await worker.fetch(new Request(`${ORIGIN}/api/sdk/keys`, { method: 'POST', headers: { origin: ORIGIN, cookie: await sessionCookie() } }), env);
  assert.equal(response.status, 201);
  return response.json();
}

async function withFetchStub(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test('vendored SDK is the unmodified lsupergen-sdk@0.1.0 npm build', async () => {
  const digest = createHash('sha256').update(await read('vendor/lsupergen-sdk/0.1.0/index.js')).digest('hex');
  assert.equal(digest, '5167fe721069a36dd0984c9c55a73349843bbf4b2f2f24d2d9cc2428ff200a88');
  assert.equal(VERSION, '0.1.0');
});

test('health is public and reports readiness without exposing secrets', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, OPENAI_API_KEY: 'sk-test-value' };
  const health = await sdkClient('lsg_unused', env).get('/health');
  assert.equal(health.ok, true);
  assert.equal(health.api_version, 'v1');
  assert.equal(health.ai_ready, true);
  assert.equal(health.package.name, 'lsupergen-sdk');
  assert.equal(JSON.stringify(health).includes('sk-test-value'), false);
});

test('API key creation requires a signed-in session and a same-origin request', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const anonymous = await worker.fetch(new Request(`${ORIGIN}/api/sdk/keys`, { method: 'POST' }), env);
  assert.equal(anonymous.status, 401);
  const crossSite = await worker.fetch(new Request(`${ORIGIN}/api/sdk/keys`, { method: 'POST', headers: { origin: 'https://evil.example', cookie: await sessionCookie() } }), env);
  assert.equal(crossSite.status, 403);
  const created = await createKey(env);
  assert.equal(created.ok, true);
  assert.match(created.api_key, /^lsg_/);
  assert.equal(created.base_url, `${ORIGIN}/v1`);
  const lifetimeDays = (Date.parse(created.key.expires_at) - Date.parse(created.key.issued_at)) / 86400000;
  assert.equal(lifetimeDays, 30);
});

test('SDK authenticates with a generated key and resolves the key owner', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const { api_key, key } = await createKey(env);
  const me = await sdkClient(api_key, env).get('/me');
  assert.equal(me.ok, true);
  assert.equal(me.user.email, 'test@example.com');
  assert.equal(me.key.id, key.id);
});

test('invalid, tampered, and session-cookie tokens surface as APIError 401', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const { api_key } = await createKey(env);
  const tampered = api_key.slice(0, -2) + (api_key.endsWith('AA') ? 'BB' : 'AA');
  for (const bad of ['lsg_invalid.key', tampered, `lsg_${await signedSession()}`, await signedSession()]) {
    await assert.rejects(sdkClient(bad, env).get('/me'), (err) => {
      assert.ok(err instanceof APIError);
      assert.equal(err.status, 401);
      assert.equal(err.body.error, 'invalid_api_key');
      return true;
    });
  }
});

test('SDK chat reaches the real OpenAI Responses path and returns the model text', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, OPENAI_API_KEY: 'test-key' };
  const { api_key } = await createKey(env);
  await withFetchStub(async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(init.body).input, 'ping from sdk');
    return new Response(JSON.stringify({ output_text: 'pong' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }, async () => {
    const reply = await sdkClient(api_key, env).post('/chat', { body: { message: 'ping from sdk' } });
    assert.equal(reply.ok, true);
    assert.equal(reply.message, 'pong');
    assert.deepEqual(reply.sources, []);
  });
});

test('SDK chat reports 503 honestly when the AI provider is not configured', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const { api_key } = await createKey(env);
  await assert.rejects(sdkClient(api_key, env).post('/chat', { body: { message: 'hello' } }), (err) => {
    assert.ok(err instanceof APIError);
    assert.equal(err.status, 503);
    assert.equal(err.body.status, 'service_unavailable');
    return true;
  });
});

test('v1 API answers CORS preflight and rejects wrong methods and unknown paths', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const preflight = await worker.fetch(new Request(`${ORIGIN}/v1/chat`, { method: 'OPTIONS' }), env);
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/);
  const { api_key } = await createKey(env);
  await assert.rejects(sdkClient(api_key, env).post('/me'), (err) => err instanceof APIError && err.status === 405);
  await assert.rejects(sdkClient(api_key, env).get('/nope'), (err) => err instanceof APIError && err.status === 404);
});

test('guide page is login-gated and /sdk points to it', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const guide = await worker.fetch(new Request(`${ORIGIN}/guide`), env);
  assert.equal(guide.status, 302);
  assert.equal(guide.headers.get('location'), '/login?return_to=%2Fguide');
  const alias = await worker.fetch(new Request(`${ORIGIN}/sdk`), env);
  assert.equal(alias.headers.get('location'), `${ORIGIN}/guide`);
  const html = String(await read('guide.html'));
  assert.match(html, /\/assets\/guide\.js/);
  const script = String(await read('assets/guide.js'));
  assert.match(script, /\/vendor\/lsupergen-sdk\/0\.1\.0\/index\.js/);
  assert.match(script, /\/api\/sdk\/keys/);
  assert.equal(/localStorage|sessionStorage/.test(script), false, 'API key must stay in memory only');
});
