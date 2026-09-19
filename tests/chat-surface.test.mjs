import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/firebase-worker.js';

const env = { ASSETS: { fetch: async request => {
  const pathname = new URL(request.url).pathname;
  const file = pathname === '/' ? 'index.html' : ['/chat', '/chat.html'].includes(pathname) ? 'chat.html' : 'getting-started.html';
  return new Response(await readFile(new URL('../' + file, import.meta.url)), { headers: { 'content-type': 'text/html' } });
}}};

test('worker preserves owned navigation on home/chat and legacy navigation on docs', async () => {
  for (const path of ['/', '/chat', '/chat.html']) {
    const response = await worker.fetch(new Request('https://example.com' + path), env);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(html, /class="ls-mobile-menu"/);
  }
  const docs = await worker.fetch(new Request('https://example.com/getting-started'), env);
  assert.match(await docs.text(), /class="ls-mobile-menu"/);
});

test('UI refresh preserves owner route and rejects unsupported chat providers', async () => {
  const control = await worker.fetch(new Request('https://example.com/control'), env);
  assert.equal(new URL(control.headers.get('location')).pathname, '/dev');
  const response = await worker.fetch(new Request('https://example.com/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'test fixture', provider: 'claude' }) }), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).status, 'provider_not_live');
});
