import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import worker from '../src/firebase-worker.js';

const root = fileURLToPath(new URL('../', import.meta.url));

async function read(path) {
  return readFile(new URL(path, `file://${root}/`), 'utf8');
}

test('wrangler routes public assets asset-first and keeps dynamic/protected routes worker-first', async () => {
  const config = await read('wrangler.toml');
  assert.doesNotMatch(config, /run_worker_first\s*=\s*true/);
  for (const route of [
    '/api/*', '/auth/*', '/dev', '/dev.html', '/dev/*',
    '/dev-code-drop', '/dev-code-drop.html',
    '/admin', '/admin.html', '/admin/*', '/control', '/owner',
  ]) {
    assert.match(config, new RegExp(`"${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
});

test('public HTML loads the static responsive navigation assets', async () => {
  const pages = [
    'index.html', 'chat.html', 'getting-started.html', 'guides.html',
    'api.html', 'tools.html', 'examples.html', 'changelog.html',
    'workspace.html', 'login.html', 'signup.html', 'provider-connect.html',
    'endpoints.html', 'system-registry.html', 'secret-handoff.html',
    'dev/control-plane/index.html',
  ];
  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /<link rel="stylesheet" href="\/public-nav\.css">/, page);
    assert.match(html, /<script src="\/public-nav\.js" defer><\/script>/, page);
  }
});

test('homepage uses the locked black, white, and blue color contract', async () => {
  const html = await read('index.html');
  assert.match(html, /--bg:#000000;/);
  assert.match(html, /--text:#FFFFFF;/);
  assert.match(html, /--accent:#0FA3D9;/);
  assert.doesNotMatch(html, /data-theme=/);
  assert.doesNotMatch(html, /new Date\(\)\.getDay\(\)/);
  assert.match(html, /overflow-x:hidden/);
});

test('admin and dev routes remain protected when the Worker runs first', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };

  const admin = await worker.fetch(new Request('https://agents-sdk.space/admin.html'), env);
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get('location'), '/dev');

  const dev = await worker.fetch(new Request('https://agents-sdk.space/dev.html'), env);
  assert.equal(dev.status, 503);
  assert.equal(dev.headers.get('x-lsuperagen-dev-gate'), 'not-configured');
});

test('chat validation fails before any provider or asset call', async () => {
  let assetCalls = 0;
  const env = { ASSETS: { fetch: async () => { assetCalls += 1; return new Response('asset'); } } };
  const response = await worker.fetch(new Request('https://agents-sdk.space/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }), env);

  assert.equal(response.status, 400);
  assert.equal(assetCalls, 0);
  assert.equal((await response.json()).status, 'validation_error');
});

test('asset exceptions return a traceable 503 instead of an unhandled 500', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(new Request('https://agents-sdk.space/missing'), {
      ASSETS: { fetch: async () => { throw new Error('simulated asset failure'); } },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '5');
    assert.equal(response.headers.get('x-lsuperagen-runtime'), 'asset-fetch-failed');
    assert.ok(response.headers.get('x-lsuperagen-request-id'));
    assert.match(await response.text(), /Request ID:/);
  } finally {
    console.error = originalError;
  }
});
