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

test('public chat uses the supplied playground with a signed-session API client', async () => {
  const html = await read('chat.html');
  const visible = visibleHtml(html);
  for (const term of forbiddenVisibleTerms) {
    assert.equal(visible.includes(term), false, `chat.html exposes internal/public-inappropriate visible term: ${term}`);
  }
  for (const id of ['chat', 'composer', 'input', 'send', 'signout']) assert.match(html, new RegExp(`id="${id}"`));
  const client = await read('assets/chat.js');
  assert.match(client, /\/api\/auth\/session/);
  assert.match(client, /\/api\/chat/);
  assert.match(client, /\/auth\/logout/);
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

test('login is the sole public entry and starts Google OAuth without guest bypass', async () => {
  const source = await read('src/index.js');
  assert.match(source, /pathname\s*===\s*['"]\/['"][\s\S]{0,360}\/login/);
  const login = visibleHtml(await read('login.html'));
  assert.match(login, /href="\/auth\/google\?return_to=\/home"/);
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

test('authenticated chat can sign out while the existing tools shell remains guarded', async () => {
  const chat = await read('chat.html');
  assert.match(chat, /id="signout"/);
  assert.match(await read('assets/chat.js'), /\/auth\/logout/);
  const tools = await read('tools.html');
  assert.match(tools, /href=["']\/auth\/logout/i);
  assert.match(tools, /app-shell\.js/i);
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
