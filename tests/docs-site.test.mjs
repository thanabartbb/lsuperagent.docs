import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import worker from '../src/index.js';
import { NAV, ICONS } from '../assets/docs-nav.js';

const ORIGIN = 'https://agents-sdk.space';
const SESSION_SECRET = 'test-session-secret';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sessionCookie() {
  const body = b64url(JSON.stringify({ typ: 'auth_session', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600, provider: 'google', id: 'docs-user' }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))));
  return `lsuperagen_trial_session=${encodeURIComponent(`${body}.${signature}`)}`;
}

test('every sidebar entry has a content file, a valid slug, and a known icon', async () => {
  const files = new Set((await readdir(new URL('../docs-content/', import.meta.url))).filter((f) => f.endsWith('.html')));
  const slugs = NAV.flatMap((group) => group.pages.map((page) => page.slug));
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug in NAV');
  for (const group of NAV) {
    assert.ok(ICONS[group.icon], `unknown group icon ${group.icon}`);
    for (const page of group.pages) {
      assert.match(page.slug, /^[a-z0-9-]+$/);
      assert.ok(ICONS[page.icon], `unknown icon ${page.icon}`);
      assert.ok(files.has(`${page.slug}.html`), `missing docs-content/${page.slug}.html`);
      const html = await read(`docs-content/${page.slug}.html`);
      assert.match(html, /^<h1>/, `${page.slug} must start with <h1>`);
      assert.equal(/<script\b/i.test(html), false, `${page.slug} must not contain scripts`);
    }
  }
  assert.deepEqual([...files].map((f) => f.replace(/\.html$/, '')).sort(), [...slugs].sort(), 'content file without a sidebar entry');
});

test('docs are login-gated and /docs opens the introduction', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const anonymous = await worker.fetch(new Request(`${ORIGIN}/docs/quickstart`), env);
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get('location'), '/login?return_to=%2Fdocs%2Fquickstart');
  const root = await worker.fetch(new Request(`${ORIGIN}/docs`, { headers: { cookie: await sessionCookie() } }), env);
  assert.equal(root.headers.get('location'), '/docs/introduction');
});

test('docs payload routes are gated too, not only the visible /docs URLs', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET, ASSETS: { fetch: async () => new Response('<h1>secret-ish</h1>', { headers: { 'content-type': 'text/html' } }) } };
  const content = await worker.fetch(new Request(`${ORIGIN}/docs-content/introduction`), env);
  assert.equal(content.status, 401);
  assert.equal((await content.json()).error, 'authentication_required');
  for (const path of ['/docs-shell', '/docs-shell.html']) {
    const shell = await worker.fetch(new Request(`${ORIGIN}${path}`), env);
    assert.equal(shell.status, 302, path);
    assert.equal(shell.headers.get('location'), '/login?return_to=%2Fdocs');
  }
  const signedIn = await worker.fetch(new Request(`${ORIGIN}/docs-content/introduction`, { headers: { cookie: await sessionCookie() } }), env);
  assert.equal(signedIn.status, 200);
});

test('signed-in /docs/:page serves the shared docs shell', async () => {
  const requested = [];
  const env = {
    AUTH_SESSION_SECRET: SESSION_SECRET,
    ASSETS: { fetch: async (req) => { requested.push(new URL(req.url).pathname); return new Response('<!doctype html><title>shell</title>', { headers: { 'content-type': 'text/html' } }); } }
  };
  const response = await worker.fetch(new Request(`${ORIGIN}/docs/api-chat`, { headers: { cookie: await sessionCookie() } }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(requested, ['/docs-shell']);
  assert.match(await response.text(), /shell/);
});

test('docs shell loads its script and styles from the same origin only', async () => {
  const shell = await read('docs-shell.html');
  assert.match(shell, /src="\/assets\/docs\.js"/);
  assert.match(shell, /href="\/assets\/docs\.css"/);
  assert.equal(/https?:\/\/(?!github\.com)/.test(shell.replace(/<a [^>]*>/g, '')), false, 'external resource in docs shell');
});
