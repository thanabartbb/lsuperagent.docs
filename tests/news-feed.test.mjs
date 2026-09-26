import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRss, parseAtom, parseHn, parseGithub, getFeed, SOURCES } from '../src/feeds.js';
import worker from '../src/index.js';

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const SESSION_SECRET = 'test-session-secret';

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sessionCookie() {
  const body = b64url(JSON.stringify({ typ: 'auth_session', iat: 1, exp: Math.floor(Date.now() / 1000) + 3600, provider: 'google', id: 'test-user', email: 'test@example.com', name: 'Test user' }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))));
  return `lsuperagen_trial_session=${encodeURIComponent(`${body}.${signature}`)}`;
}

async function withFetchStub(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

function mockFetch(map) {
  return async (url) => {
    const key = Object.keys(map).find((k) => String(url).includes(k));
    if (!key) return new Response('nope', { status: 500 });
    return new Response(map[key]);
  };
}

test('parsers normalise real upstream samples', () => {
  const rss = parseRss(fx('openai.rss.xml'), 'openai');
  assert.equal(rss.length, 3);
  assert.equal(rss[0].title, 'Better prompt caching for GPT-6');
  assert.equal(rss[0].time, Date.parse('Tue, 22 Sep 2026 21:00:00 GMT'));

  const atom = parseAtom(fx('claude.atom.xml'), 'claude');
  assert.equal(atom[0].url, 'https://github.com/anthropics/claude-code/releases/tag/v2.1.280');
  assert.ok(!atom[0].description.includes('<'));

  const hn = parseHn(JSON.parse(fx('hn.json')), 'anthropic');
  assert.equal(hn[1].url, 'https://news.ycombinator.com/item?id=49809846');

  const gh = parseGithub(JSON.parse(fx('github.json')), 'community');
  assert.equal(gh[0].repo, 'affaan-m/ECC');
  assert.equal(gh[1].url, null, 'non-http(s) links must be dropped');
});

test('getFeed("all") merges newest first and reports failed sources', async () => {
  const fetchImpl = mockFetch({ 'openai.com': fx('openai.rss.xml'), 'releases.atom': fx('claude.atom.xml'), 'query=Anthropic': fx('hn.json') });
  const feed = await getFeed('all', { fetchImpl });
  assert.ok(feed.items.length >= 6);
  for (let i = 1; i < feed.items.length; i++) assert.ok(feed.items[i - 1].time >= feed.items[i].time);
  assert.deepEqual(feed.errors.map((e) => e.source).sort(), ['ai', 'grok']);
  assert.deepEqual(Object.keys(SOURCES), ['openai', 'anthropic', 'claude', 'grok', 'ai', 'community']);
});

test('/api/feed requires a signed session', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/api/feed'), { AUTH_SESSION_SECRET: SESSION_SECRET });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'authentication_required');
});

test('/api/feed rejects unknown sources and non-GET methods', async () => {
  const env = { AUTH_SESSION_SECRET: SESSION_SECRET };
  const cookie = await sessionCookie();
  for (const source of ['nope', 'constructor', '__proto__']) {
    const bad = await worker.fetch(new Request(`https://agents-sdk.space/api/feed?source=${source}`, { headers: { cookie } }), env);
    assert.equal(bad.status, 400, source);
  }
  const post = await worker.fetch(new Request('https://agents-sdk.space/api/feed', { method: 'POST', headers: { cookie } }), env);
  assert.equal(post.status, 405);
});

test('/api/feed returns live items for a signed-in user', async () => {
  await withFetchStub(mockFetch({ 'openai.com': fx('openai.rss.xml') }), async () => {
    const response = await worker.fetch(new Request('https://agents-sdk.space/api/feed?source=openai', { headers: { cookie: await sessionCookie() } }), { AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.source, 'openai');
    assert.equal(body.items.length, 3);
    assert.deepEqual(body.errors, []);
  });
});

test('/api/feed reports 502 when every upstream fails', async () => {
  await withFetchStub(async () => new Response('down', { status: 503 }), async () => {
    const response = await worker.fetch(new Request('https://agents-sdk.space/api/feed?source=grok', { headers: { cookie: await sessionCookie() } }), { AUTH_SESSION_SECRET: SESSION_SECRET });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.deepEqual(body.items, []);
    assert.equal(body.errors[0].source, 'grok');
  });
});

test('/news is login-gated and linked from home', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/news'), {});
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'), 'https://agents-sdk.space');
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('return_to'), '/news');
  assert.match(read('home.html'), /href="\/news"/);
});

test('news page renders upstream data without innerHTML and loads its script same-origin', () => {
  const html = read('news.html');
  const js = read('assets/news.js');
  assert.match(html, /<script src="\/assets\/news\.js" defer><\/script>/);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(js, /\/api\/feed\?source=/);
});
