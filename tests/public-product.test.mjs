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

test('standalone pages use the reference palette across the site', async () => {
  const { readdir } = await import('node:fs/promises');
  const theme = await read('assets/theme.css');
  assert.match(theme, /--bg: #050812 !important/);
  assert.match(theme, /--accent: #4da3ff !important/);
  for (const name of await readdir(new URL('..', import.meta.url))) {
    if (!name.endsWith('.html')) continue;
    assert.match(await read(name), /\/assets\/theme\.css\?v=\d+/,  `${name} has no shared palette`);
  }
});

test('published npmjs.sdk-space is identified separately from the API client', async () => {
  const landing = await read('loading.html');
  assert.match(landing, /npmjs\.sdk-space/);
  assert.match(landing, /https:\/\/www\.npmjs\.com\/package\/npmjs\.sdk-space/);
  assert.match(landing, /Explore the package, inspect its exports/);
  assert.match(landing, /lsupergen-sdk/);
});

test('SDKSPACE reference colors carry into the guide while Docs mode stays muted purple', async () => {
  const landing = await read('loading.html');
  const guide = await read('guide.html');
  const core = await read('assets/guide-core.css');
  const modes = await read('assets/theme-modes.css');
  const script = await read('assets/theme-modes.js');

  for (const [name, html] of [['guide.html', guide]]) {
    assert.match(html, /\/assets\/theme-modes\.css\?v=3/);
    assert.match(html, /\/assets\/theme-modes\.js\?v=2/);
    assert.match(html, /data-theme-toggle/);
    assert.match(html, /\/assets\/theme\.css\?v=4/);
  }

  assert.match(landing, /#0d1a2e/);
  assert.match(landing, /#030509/);
  assert.match(landing, /sdkspace-reference-modes\.css/);
  assert.match(landing, /data-theme-toggle/);
  assert.match(await read('assets/sdkspace-docs-intro.css'), /#050505/);
  assert.match(await read('docs-content/introduction.html'), /sdkspace-intro/);
  assert.match(guide, /guide-core\.css\?v=4[\s\S]*theme-modes\.css\?v=3/);
  assert.match(core, /\.tab\{[^}]*background:#050812!important;opacity:1!important;/);
  assert.match(modes, /Normal mode follows the SDKSPACE blue-black reference/);
  assert.match(modes, /html:not\(\[data-theme="docs"\]\) :is\([\s\S]*background: #090f1b !important/);
  assert.match(modes, /html\[data-theme="docs"\][\s\S]*--mode-accent: #70568f/);
  assert.match(script, /lsuperagent-color-mode/);
  assert.match(script, /addEventListener\('click'/);
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

test('public resources are separate from Google OAuth login without guest chat bypass', async () => {
  const source = await read('src/index.js');
  assert.match(source, /publicResource\(request, pathname\)/);
  const login = visibleHtml(await read('login.html'));
  assert.match(login, /href="\/auth\/google\?return_to=\/home"/);
  assert.equal(/Guest|ทดลองแชท/i.test(login), false, 'login must not offer an unauthenticated bypass');
});

test('static root fallback also points to the login entry', async () => {
  const index = await read('index.html');
  assert.match(index, /url=\/login/);
  assert.doesNotMatch(index, /url=\/chat/);
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

test('SDKSPACE CTA text colors keep readable contrast', async () => {
  for (const page of ['home.html', 'loading.html']) {
    assert.match(await read(page), /a\.btn-primary\{color:#ffffff;\}/);
  }
  assert.match(
    await read('assets/sdkspace-docs-intro.css'),
    /\.sdkspace-intro a\.btn-primary\{color:#eef2f5;\}/,
  );
});

test('SDKSPACE pages share the canonical logo and Docs intro fills the viewport width', async () => {
  for (const name of ['home.html', 'loading.html']) {
    const html = await read(name);
    assert.ok(html.includes('<img class="cube-icon" src="/assets/sdkspace-logo.svg" alt="" width="22" height="22">'));
    assert.equal(html.includes('<svg class="cube-icon"'), false);
  }

  const introCss = await read('assets/sdkspace-docs-intro.css');
  const fullBleed = introCss.slice(introCss.lastIndexOf('/* Full-bleed canvas for the SDKSPACE introduction inside Docs. */'));
  assert.match(fullBleed, /width:100vw;/);
  assert.match(fullBleed, /max-width:none;/);
  assert.match(fullBleed, /border-radius:0;/);
  assert.match(fullBleed, /min-height:calc\(100svh/);
});

test('attachment control opens a menu for tools, providers, and selectable models', async () => {
  const html = await read('chat.html');
  for (const id of ['chat-tools-menu', 'tool-choice', 'provider', 'model-choice', 'choose-file']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing chat menu control: ${id}`);
  }
  const client = await read('assets/chat.js');
  assert.ok(client.includes('/api/image'));
  assert.match(client, /tool: mode/);
  assert.match(client, /model: modelChoice.value/);
  assert.match(client, /aria-expanded/);
});

test('active site pages share the SDKSPACE name and canonical logo asset', async () => {
  const pages = [
    'home.html', 'loading.html', 'chat.html', 'guide.html', 'login.html',
    'signup.html', 'forgot-password.html', 'news.html', 'keys.html',
    'tools.html', 'exa.html', 'dev.html', 'dev-code-drop.html', 'docs-shell.html',
  ];
  for (const name of pages) {
    const html = await read(name);
    assert.match(html, /<img[^>]+src=["']\/assets\/sdkspace-logo\.svg["']/i, `${name} must use the shared logo`);
    assert.match(visibleHtml(html), /SDKSPACE/i, `${name} must show the canonical site name`);
    assert.doesNotMatch(visibleHtml(html), /LSUPERAGENT/i, `${name} must not show the old product name`);
  }

  const logo = await read('assets/sdkspace-logo.svg');
  assert.match(logo, /<svg[\s\S]*<path/i);
  const nextHeader = await read('next-app/components/site-header.jsx');
  const nextFooter = await read('next-app/components/site-footer.jsx');
  const nextLayout = await read('next-app/app/layout.jsx');
  assert.match(nextHeader, /SDKSPACE/);
  assert.match(nextFooter, /SDKSPACE/);
  assert.match(nextLayout, /SDKSPACE/);
  assert.doesNotMatch(nextHeader + nextFooter + nextLayout, /LSUPERAGENT/i);
});

test('SDKSPACE intro pages load the full-screen mobile layout rules', async () => {
  for (const name of ['home.html', 'loading.html']) {
    assert.match(await read(name), /sdkspace-reference-modes\.css\?v=2/);
  }
  const css = await read('assets/sdkspace-reference-modes.css');
  const mobileLayout = css.slice(css.lastIndexOf('@media (max-width: 600px){'));
  assert.match(mobileLayout, /body\[data-sdkspace-page\] > \.phone[\s\S]*max-width:none;[\s\S]*min-height:100svh;[\s\S]*border:0;[\s\S]*border-radius:0;/);
});
