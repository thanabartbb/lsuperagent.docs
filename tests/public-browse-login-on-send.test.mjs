import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/firebase-worker.js';

const ORIGIN = 'https://agents-sdk.space';
const assets = { fetch: async request => new Response(
  '<!doctype html><title>' + new URL(request.url).pathname + '</title>',
  { headers: { 'content-type': 'text/html' } }
) };

test('visitors browse root, home and classic chat without redirects', async () => {
  const root = await worker.fetch(new Request(ORIGIN + '/'), { ASSETS: assets });
  assert.equal(root.status, 200);
  const homepage = await root.text();
  assert.match(homepage, /href="\/chat"/);
  for (const path of ['/home', '/home.html', '/chat']) {
    const result = await worker.fetch(new Request(ORIGIN + path), { ASSETS: assets });
    assert.equal(result.status, 200, path);
    assert.equal(result.headers.get('location'), null);
  }
});

test('guest classic chat does not access the protected Agent Starter runtime', async () => {
  let agentCalls = 0;
  const env = { ASSETS: assets, AGENT_STARTER: { fetch() {
    agentCalls++;
    return new Response('private');
  } } };
  const guest = await worker.fetch(new Request(ORIGIN + '/chat?mode=code'), env);
  assert.equal(guest.status, 200);
  assert.match(await guest.text(), /chat.html/);
  assert.equal(agentCalls, 0);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/agent-ui/assets/main.js'), env)).status, 401);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/api/agent-runtime/config'), env)).status, 401);
});

test('anonymous messages, images, history and account keys remain protected', async () => {
  const env = { ASSETS: assets, OPENAI_API_KEY: 'test-placeholder' };
  for (const api of ['/api/chat', '/api/image']) {
    const result = await worker.fetch(new Request(ORIGIN + api, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'test', prompt: 'test' })
    }), env);
    assert.equal(result.status, 401, api);
    assert.equal((await result.json()).error, 'authentication_required');
  }
  assert.equal((await worker.fetch(new Request(ORIGIN + '/api/chats'), env)).status, 401);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/api/sdk/keys', { method: 'POST' }), env)).status, 401);
  assert.equal((await worker.fetch(new Request(ORIGIN + '/keys'), env)).status, 302);
});

test('browser prompts login on send and preserves text drafts, without preview generation', async () => {
  const client = await readFile(new URL('../assets/chat.js', import.meta.url), 'utf8');
  const homeNavigation = await readFile(new URL('../assets/sdkspace-navigation.js', import.meta.url), 'utf8');
  assert.match(client, /if \(!signedIn\) \{\s*if \(input\.value\.trim\(\)\) toLogin\(input\.value\.trim\(\)\)/);
  assert.match(client, /sessionStorage\.setItem\(AUTH_DRAFT_KEY/);
  assert.match(client, /resume_draft=1/);
  assert.match(client, /AUTH_DRAFT_TTL_MS/);
  assert.doesNotMatch(homeNavigation, /location\.replace\('\/login\?return_to=\/home'\)/);
});
