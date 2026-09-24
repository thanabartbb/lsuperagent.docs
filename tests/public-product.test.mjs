import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const visibleHtml = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

const forbiddenVisibleTerms = [
  'Runtime',
  'Secret DETECTED',
  'OPENAI LIVE',
  'Provider target',
  'PUBLIC SESSION',
  'TRUTH ROUTER',
  'Owner workspace',
  'Development Console',
  'PLANNED',
  'BLOCKED',
  'NOT WIRED',
];

test('public chat is an end-user workspace without developer readiness copy', async () => {
  const html = await read('chat.html');
  const visible = visibleHtml(html);
  for (const term of forbiddenVisibleTerms) {
    assert.equal(visible.includes(term), false, `chat.html exposes internal/public-inappropriate visible term: ${term}`);
  }
  for (const label of ['Chat', 'Code', 'Image', 'Research', 'Read URL', 'Write']) {
    assert.equal(visible.includes(label), true, `missing user mode: ${label}`);
  }
  assert.match(html, /copy/i, 'text answers need a Copy action');
  assert.match(html, /download/i, 'image results need a Download action');
});

test('public product uses the locked black white blue token contract', async () => {
  const css = await read('app.css');
  assert.match(css, /--bg:\s*#000(?:000)?\b/i);
  assert.match(css, /--text:\s*#fff(?:fff)?\b/i);
  assert.match(css, /--accent:\s*#0fa3d9\b/i);
});

test('worker enables real web research and URL reading with returned sources', async () => {
  const source = await read('src/index.js');
  assert.match(source, /type:\s*['"]web_search['"]/);
  assert.match(source, /web_search_call\.action\.sources/);
  assert.match(source, /url_citation/);
  assert.match(source, /\burl\b.*Tool context|Tool context.*\burl\b/is);
});

test('worker enables real image generation instead of planned prompt-only image mode', async () => {
  const source = await read('src/index.js');
  assert.match(source, /\/v1\/images\/generations/);
  assert.match(source, /gpt-image-2/);
  assert.match(source, /b64_json/);
  assert.equal(source.includes("'/api/image': { status: 'planned'"), false);
});

test('large code input is no longer constrained to the audited 4000 character ceiling', async () => {
  const source = await read('src/index.js');
  assert.equal(/message\.length\s*>\s*4000\b/.test(source), false);
  const match = source.match(/message\.length\s*>\s*(\d+)/);
  assert.ok(match, 'worker must keep an explicit bounded message limit');
  assert.ok(Number(match[1]) >= 30000, `message limit is still too small: ${match[1]}`);
});

test('login is the sole public entry and has account auth without guest bypass', async () => {
  const source = await read('src/index.js');
  assert.match(source, /pathname\s*===\s*['"]\/['"][\s\S]{0,360}\/login/);
  const login = visibleHtml(await read('login.html'));
  assert.match(login, />Google</);
  assert.match(login, />GitHub</);
  assert.match(login, />Gmail</);
  assert.match(login, /name="email"/i);
  assert.match(login, /name="password"/i);
  assert.equal(/Guest|ทดลองแชท/i.test(login), false, 'login must not offer an unauthenticated bypass');
});

test('static root fallback also points to the login entry', async () => {
  const index = await read('index.html');
  assert.match(index, /url=\/login/);
  assert.doesNotMatch(index, /url=\/chat/);
});

test('injected public navigation does not expose docs or developer surfaces', async () => {
  const source = await read('src/index.js');
  const start = source.indexOf('function publicMobileLinks');
  const end = source.indexOf('function enhancePublicHtml', start);
  assert.ok(start >= 0 && end > start, 'publicMobileLinks function must exist');
  const publicNav = source.slice(start, end);
  for (const term of ["'/getting-started'", "'/api'", "'/guides'", "'/changelog'", "'/examples'", "'/dev'"]) {
    assert.equal(publicNav.includes(term), false, `legacy/developer public nav remains: ${term}`);
  }
});

test('authenticated product shell exposes chat, tools, and logout navigation', async () => {
  for (const file of ['chat.html', 'tools.html']) {
    const html = await read(file);
    assert.match(html, /href=["']\/chat/i);
    assert.match(html, /href=["']\/tools/i);
    assert.match(html, /href=["']\/auth\/logout/i);
    assert.match(html, /app-shell\.js/i);
    assert.match(html, /data-shell-page=/);
  }
});

test('signup does not offer guest workspace bypass', async () => {
  const html = visibleHtml(await read('signup.html'));
  assert.equal(/Guest|ทดลองแชท/i.test(html), false);
  assert.match(html, /\/auth\/google/i);
  assert.match(html, /\/login/i);
  assert.match(html, /name=["']email["']/i);
  assert.match(html, /data-email-register/);
});

test('tools surface contains only usable end-user product capabilities', async () => {
  const html = visibleHtml(await read('tools.html'));
  for (const term of ['PLANNED', 'BLOCKED', 'Admin', 'Endpoints', 'Secret Handoff', 'SDK Plug Tools', 'Development Console']) {
    assert.equal(html.includes(term), false, `tools.html still exposes developer/unavailable surface: ${term}`);
  }
});
