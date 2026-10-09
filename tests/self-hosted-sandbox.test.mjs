import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyWebhook } from '../services/sdkspace-sandbox/src/webhook.js';
import { handleSandboxApi } from '../src/openai-agent-sessions.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const origin = 'https://agents-sdk.space';
const alice = { provider: 'google', id: 'alice-sub', email: 'owner@example.com' };
const bob = { provider: 'google', id: 'bob-sub', email: 'bob@example.com' };
const opts = {
  SANDBOX_ENABLED: 'true', OWNER_GOOGLE_EMAIL: 'owner@example.com',
  OPENAI_API_KEY: 'local-mock', OPENAI_AGENT_ID: 'agent_demo'
};

function req(path, method = 'GET', body) {
  return new Request(origin + path, {
    method, headers: method === 'GET' ? {} : {
      origin, 'content-type': 'application/json'
    }, body: method === 'GET' ? undefined : JSON.stringify(body)
  });
}

function dbFor(owned = false) {
  return { prepare(sql) {
    const state = { sql, params: [] };
    return {
      bind(...params) { state.params = params; return this; },
      async first() {
        return owned && state.params[1] === 'google:alice-sub' ? { session_id: state.params[0] } : null;
      },
      async all() { return { results: [] }; },
      async run() { return { success: true }; }
    };
  } };
}

test('sandbox access is closed by default and owner-only', async () => {
  assert.equal((await handleSandboxApi(req('/api/sandbox/sessions'), { ...opts, DB: dbFor(), SANDBOX_ENABLED: undefined }, alice)).status, 403);
  assert.equal((await handleSandboxApi(req('/api/sandbox/sessions'), { ...opts, DB: dbFor() }, bob)).status, 403);
  assert.equal((await handleSandboxApi(req('/api/sandbox/sessions'), { ...opts, DB: dbFor() }, null)).status, 401);
});

test('cannot retrieve an unowned session', async () => {
  const response = await handleSandboxApi(req('/api/sandbox/sessions/sess_abcd1234'), { ...opts, DB: dbFor(false) }, alice);
  assert.equal(response.status, 404);
});

test('state change requires a same-origin JSON request', async () => {
  const cross = new Request(origin + '/api/sandbox/sessions', {
    method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}'
  });
  const response = await handleSandboxApi(cross, { ...opts, DB: dbFor() }, alice);
  assert.equal(response.status, 403);
});

test('session read hides provider credentials and checks ownership', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_, init) => {
      assert.equal(init.headers.get('authorization'), 'Bearer local-mock');
      return Response.json({ status: 'idle', environment: { status: 'connected', remote_url: 'PRIVATE' } });
    };
    const response = await handleSandboxApi(req('/api/sandbox/sessions/sess_abcd1234'), { ...opts, DB: dbFor(true) }, alice);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).environment_status, 'connected');
  } finally { globalThis.fetch = original; }
});

test('webhook HMAC validates signatures and rejects old timestamps', async () => {
  const bytes = new TextEncoder().encode('a correct signing key');
  const encoded = Buffer.from(bytes).toString('base64');
  const secret = 'whsec_' + encoded;
  const now = 1_797_000_000_000;
  const timestamp = String(now / 1000);
  const id = 'evt_demo';
  const payload = '{"type":"agent.session.created","data":{"id":"sess_12345"}}';
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + timestamp + '.' + payload))).toString('base64');
  const headers = new Headers({
    'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': 'v1,' + sig
  });
  assert.equal(await verifyWebhook(payload, headers, secret, now), true);
  assert.equal(await verifyWebhook(payload + 'x', headers, secret, now), false);
  assert.equal(await verifyWebhook(payload, headers, secret, now + 301000), false);
});
