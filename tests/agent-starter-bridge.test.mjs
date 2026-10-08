import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/firebase-worker.js';

const ORIGIN = 'https://agents-sdk.space';
const SESSION_SECRET = 'agent-bridge-test-secret';

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function cookieFor(id) {
  const body = b64url(JSON.stringify({
    typ: 'auth_session',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
    provider: 'google',
    id,
    email: id + '@example.com',
    name: id
  }));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = b64url(String.fromCharCode(
    ...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  ));
  return 'lsuperagen_trial_session=' + encodeURIComponent(body + '.' + sig);
}

async function authedRequest(path, id = 'alice', init = {}) {
  const headers = new Headers(init.headers || {});
  const extraCookie = headers.get('cookie');
  const sessionCookie = await cookieFor(id);
  headers.set('cookie', extraCookie ? sessionCookie + '; ' + extraCookie : sessionCookie);
  return new Request(ORIGIN + path, { ...init, headers });
}

test('legacy Agent Chat URL redirects to the single full-screen /chat entry', async () => {
  const response = await worker.fetch(new Request(ORIGIN + '/agent-chat?source=bookmark'), {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/chat?source=bookmark');
});

test('agent runtime config is session-gated and returns an opaque per-user instance', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, AGENT_STARTER: { fetch: async () => new Response('unused') } };

  const anonymous = await worker.fetch(new Request(ORIGIN + '/api/agent-runtime/config'), env);
  assert.equal(anonymous.status, 401);

  const alice1 = await worker.fetch(await authedRequest('/api/agent-runtime/config', 'alice'), env);
  const alice2 = await worker.fetch(await authedRequest('/api/agent-runtime/config', 'alice'), env);
  const bob = await worker.fetch(await authedRequest('/api/agent-runtime/config', 'bob'), env);
  assert.equal(alice1.status, 200);
  const a1 = await alice1.json();
  const a2 = await alice2.json();
  const b = await bob.json();

  assert.equal(a1.agent, 'ChatAgent');
  assert.equal(a1.path, '/agents');
  assert.equal(a1.connected, true);
  assert.match(a1.name, /^u_[A-Za-z0-9_-]{24,}$/);
  assert.equal(a1.name, a2.name);
  assert.notEqual(a1.name, b.name);
  assert.equal(JSON.stringify(a1).includes('alice'), false);
});

test('agent proxy rejects the shared default instance and only forwards the signed-in user instance', async () => {
  let forwarded = null;
  const env = {
    AUTH_SESSION_SECRET: SESSION_SECRET,
    AGENT_STARTER: {
      fetch: async (request) => {
        forwarded = request;
        return new Response('agent-ok', { status: 200, headers: { 'x-agent-starter': 'ok' } });
      }
    }
  };

  const config = await (await worker.fetch(await authedRequest('/api/agent-runtime/config', 'alice'), env)).json();

  const denied = await worker.fetch(await authedRequest('/agents/chat-agent/default', 'alice'), env);
  assert.equal(denied.status, 403);
  assert.equal(forwarded, null);

  const response = await worker.fetch(await authedRequest(
    '/agents/chat-agent/' + encodeURIComponent(config.name) + '?resume=1',
    'alice',
    { headers: { authorization: 'Bearer must-not-leak', origin: ORIGIN, 'x-test-bridge': 'kept', cookie: 'agent_oauth=keep-me' } }
  ), env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'agent-ok');
  assert.ok(forwarded);
  assert.equal(new URL(forwarded.url).pathname, '/agents/chat-agent/' + config.name);
  assert.equal(new URL(forwarded.url).search, '?resume=1');
  assert.equal(forwarded.headers.get('cookie'), 'agent_oauth=keep-me');
  assert.equal(forwarded.headers.get('authorization'), null);
  assert.equal(forwarded.headers.get('origin'), ORIGIN);
  assert.equal(forwarded.headers.get('x-test-bridge'), 'kept');
  assert.equal(forwarded.headers.get('x-sdkspace-agent-bridge'), 'v1');
});

test('agent proxy fails closed when the service binding is absent', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const config = await (await worker.fetch(await authedRequest('/api/agent-runtime/config', 'alice'), env)).json();
  assert.equal(config.connected, false);

  const response = await worker.fetch(await authedRequest('/agents/chat-agent/' + config.name, 'alice'), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'agent_runtime_unavailable');
});

test('MCP OAuth callback routes can be forwarded without leaking the SDKSPACE session cookie', async () => {
  let forwarded = null;
  const env = {
    AUTH_SESSION_SECRET: SESSION_SECRET,
    AGENT_STARTER: {
      fetch: async (request) => {
        forwarded = request;
        return new Response('<script>window.close()</script>', { headers: { 'content-type': 'text/html' } });
      }
    }
  };

  const response = await worker.fetch(await authedRequest(
    '/oauth/callback?code=abc&state=xyz',
    'alice',
    { headers: { cookie: 'agent_oauth=keep-me' } }
  ), env);
  assert.equal(response.status, 200);
  assert.equal(new URL(forwarded.url).pathname, '/oauth/callback');
  assert.equal(forwarded.headers.get('cookie'), 'agent_oauth=keep-me');
});

test('wrangler declares the internal service binding to agent-starter as real TOML lines', async () => {
  const wrangler = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.equal(wrangler.includes('\\n[[services]]'), false);
  assert.match(
    wrangler,
    /^\[\[services\]\]\nbinding\s*=\s*"AGENT_STARTER"\nservice\s*=\s*"agent-starter"$/m
  );
});


test('Agent Starter UI is gated and adapts its real asset paths with a per-user agent name', async () => {
  const calls = [];
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, AGENT_STARTER: { fetch: async req => {
    calls.push(req);
    const path = new URL(req.url).pathname;
    return new Response(path === '/' ? '<title>Agent Starter</title><script type="module" src="/assets/index-build.js"></script><link href="/assets/index-build.css"><div id="root"></div>' : 'const agent=On({agent:`ChatAgent`,onOpen:()=>{}});', {headers:{'content-type':path === '/' ? 'text/html' : 'text/javascript'}});
  }}};
  const anon = await worker.fetch(new Request(ORIGIN+'/chat'), env);
  assert.equal(anon.status,302);
  assert.match(anon.headers.get('location'), /login/);
  assert.equal(calls.length,0);
  const html = await worker.fetch(await authedRequest('/chat'),env);
  assert.equal(html.status,200);
  const page = await html.text();
  assert.match(page, /\/agent-ui\/assets\/index-build.js/);
  assert.match(page, /id="sdkspace-chat-viewport"/);
  assert.equal(html.headers.get('cache-control'),'private, no-store');
  const a = await worker.fetch(await authedRequest('/agent-ui/assets/index-build.js','alice'),env);
  const b = await worker.fetch(await authedRequest('/agent-ui/assets/index-build.js','bob'),env);
  const sa = await a.text(), sb = await b.text();
  assert.match(sa, /name:"u_[A-Za-z0-9_-]+",host:location.host/);
  assert.notEqual(sa,sb);
  assert.equal(calls.every(req=>!req.headers.has('cookie') && !req.headers.has('authorization')),true);
  const head = await worker.fetch(await authedRequest('/chat','alice',{method:'HEAD'}),env);
  assert.equal(await head.text(),'');
});

test('Agent UI rejects unsupported builds, paths and methods without exposing shared default chat', async () => {
  const env = {AUTH_SESSION_SECRET:SESSION_SECRET,AGENT_STARTER:{fetch:async()=>new Response('changed build')}};
  assert.equal((await worker.fetch(await authedRequest('/agent-ui/assets/index-new.js'),env)).status,503);
  assert.equal((await worker.fetch(await authedRequest('/agent-ui/secrets'),env)).status,404);
  assert.equal((await worker.fetch(await authedRequest('/chat','alice',{method:'POST'}),env)).status,405);
  assert.equal((await worker.fetch(await authedRequest('/chat'),{AUTH_SESSION_SECRET:SESSION_SECRET})).status,503);
  assert.equal((await worker.fetch(new Request(ORIGIN+'/agent-ui/assets/index-new.js'),env)).status,401);
});

test('Agent UI forwards lazy code-highlighting chunks without changing them', async () => {
  const env = {AUTH_SESSION_SECRET:SESSION_SECRET,AGENT_STARTER:{fetch:async req => new Response(new URL(req.url).pathname === '/' ? '<script src="/assets/index-build.js"></script><div id="root"></div>' : 'export const language="javascript";', {headers:{'content-type':'text/javascript'}})}};
  const result = await worker.fetch(await authedRequest('/agent-ui/assets/javascript-chunk.js'),env);
  assert.equal(result.status,200);
  assert.equal(await result.text(),'export const language="javascript";');
});
