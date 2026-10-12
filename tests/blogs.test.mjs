import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResource } from '../src/public-resources.js';
import worker from '../src/index.js';

const request = (path, options = {}) => new Request('https://agents-sdk.space' + path, options);
test('anonymous blog index and articles render through the existing Worker router', async () => {
  for (const path of ['/blogs', '/blogs/css-cascade-contrast', '/blogs/responses-api-server', '/blogs/openai-update-checklist', '/blogs/cloudflare-workflows-map']) {
    const response = await worker.fetch(request(path), {}, { waitUntil() {} });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<html lang="th"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /<main id="main-content"/);
    assert.match(html, /canonical/);
    assert.doesNotMatch(html, /authentication_required/);
  }
});
test('category and query filters work without client JavaScript and escape input', async () => {
  const response = publicResource(request('/blogs?category=til&q=CSS'), '/blogs');
  const html = await response.text();
  assert.match(html, /css-cascade-contrast/);
  assert.doesNotMatch(html, /href="\/blogs\/responses-api-server"/);
  const empty = await publicResource(request('/blogs?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E'), '/blogs').text();
  assert.match(empty, /ยังไม่พบบทความ/);
  assert.doesNotMatch(empty, /<script>alert\(1\)<\/script>/);
  assert.match(empty, /&lt;script&gt;/);
});
test('blog routes support HEAD, Markdown, canonical aliases and explicit missing pages', async () => {
  const head = publicResource(request('/blogs', { method: 'HEAD' }), '/blogs');
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const md = publicResource(request('/blogs/responses-api-server', { headers: { accept: 'text/markdown' } }), '/blogs/responses-api-server');
  assert.match(md.headers.get('content-type'), /text\/markdown/);
  assert.match(await md.text(), /```javascript[\s\S]*OPENAI_API_KEY[\s\S]*```/);
  for (const path of ['/blog', '/blogs/']) {
    const response = publicResource(request(path + '?category=til'), path);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/blogs?category=til');
  }
  assert.equal(publicResource(request('/blogs/missing'), '/blogs/missing').status, 404);
  assert.equal(publicResource(request('/blogs/%3Cscript%3E'), '/blogs/%3Cscript%3E').status, 404);
  const post = publicResource(request('/blogs', { method: 'POST' }), '/blogs');
  assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
});
test('article URLs are discoverable and first pages link to blogs', async () => {
  const sitemap = await publicResource(request('/sitemap.xml'), '/sitemap.xml').text();
  assert.match(sitemap, /https:\/\/agents-sdk\.space\/blogs\/css-cascade-contrast/);
  const home = await publicResource(request('/'), '/').text();
  assert.match(home, /href="\/blogs"/);
  assert.match(home, /css-cascade-contrast/);
});
