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
  assert.match(source, /type:\s*['"]image_generation['"]/);
  assert.match(source, /image_generation_call/);
  assert.equal(source.includes("'/api/image': { status: 'planned'"), false);
});

test('large code input is no longer constrained to the audited 4000 character ceiling', async () => {
  const source = await read('src/index.js');
  assert.equal(/message\.length\s*>\s*4000\b/.test(source), false);
  const match = source.match(/message\.length\s*>\s*(\d+)/);
  assert.ok(match, 'worker must keep an explicit bounded message limit');
  assert.ok(Number(match[1]) >= 30000, `message limit is still too small: ${match[1]}`);
});

test('root product no longer presents a marketing/developer landing step', async () => {
  const source = await read('src/index.js');
  assert.match(source, /pathname\s*===\s*['"]\/['"][\s\S]{0,260}(chat\.html|\/chat)/);
  const landing = await read('index.html');
  assert.equal(visibleHtml(landing).includes('Build with AI.'), false);
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

test('tools surface contains only usable end-user product capabilities', async () => {
  const html = visibleHtml(await read('tools.html'));
  for (const term of ['PLANNED', 'BLOCKED', 'Admin', 'Endpoints', 'Secret Handoff', 'SDK Plug Tools', 'Development Console']) {
    assert.equal(html.includes(term), false, `tools.html still exposes developer/unavailable surface: ${term}`);
  }
});
