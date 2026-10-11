import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/firebase-worker.js';

const ORIGIN = 'https://agents-sdk.space';
const HTML = readFile(new URL('../chat.html', import.meta.url), 'utf8');
const ASSETS = {
  async fetch(req) {
    assert.equal(new URL(req.url).pathname, '/chat.html');
    return new Response(await HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
};

test('visitor /chat looks like Agent layout but still uses original classic composer', async () => {
  let touchedAgent = false;
  const response = await worker.fetch(new Request(ORIGIN + '/chat'), {
    ASSETS,
    AGENT_STARTER: { fetch() { touchedAgent = true; throw new Error('not accessible'); } }
  });
  assert.equal(response.status, 200);
  assert.equal(touchedAgent, false);
  assert.equal(response.headers.get('x-lsuperagen-control'), 'legacy-chat-fallback-v1');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const html = await response.text();
  assert.match(html, /class="sdk-layout sdk-chat sdkspace-visitor-chat"/);
  assert.match(html, /\/assets\/chat-visitor-reference\.css\?v=1/);
  for (const id of ['chat', 'composer', 'input', 'send', 'attach', 'history', 'tool-choice', 'provider', 'model-choice']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /\/assets\/chat\.js\?v=12/);
});

test('visitor HEAD /chat does not inject presentation HTML and has empty body', async () => {
  const response = await worker.fetch(new Request(ORIGIN + '/chat', { method: 'HEAD' }), { ASSETS });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('guest CSS is isolated from signed-in Agent Starter and all non-chat pages', async () => {
  const css = await readFile(new URL('../assets/chat-visitor-reference.css', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(css, /sdkspace-visitor-chat/);
  assert.match(css, /#composer #send/);
  assert.match(css, /#chat #empty/);
  assert.match(css, /#history/);
  assert.doesNotMatch(css, /fetch\(|WebSocket|Agent\.stub/);
  assert.match(source, /legacyChatFallback\(request, env, true\)/);
  assert.match(source, /if \(visitor && request\.method === 'GET'/);
});

test('guest cannot send to either AI backend without authentication', async () => {
  const env = { ASSETS, OPENAI_API_KEY: 'test-only' };
  const post = await worker.fetch(new Request(ORIGIN + '/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' })
  }), env);
  assert.equal(post.status, 401);
  const agent = await worker.fetch(new Request(ORIGIN + '/api/agent-runtime/config'), env);
  assert.equal(agent.status, 401);
});
