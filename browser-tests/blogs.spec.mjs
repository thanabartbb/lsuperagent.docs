import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicResource } from '../src/public-resources.js';
import { BLOG_POSTS } from '../src/blog-content.js';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
let server, origin;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const response = publicResource(new Request('http://localhost' + req.url), url.pathname);
    if (response) { res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return; }
    if (url.pathname === '/api/auth/session') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"authenticated":false}'); return; }
    const file = resolve(root, '.' + (url.pathname === '/home' ? '/home.html' : url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try { const bytes = await readFile(file); res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); res.end(bytes); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { if (server) await new Promise(done => server.close(done)); });
const routes = ['/', '/home', '/blogs', ...BLOG_POSTS.map(p => '/blogs/' + p.slug), '/blogs/missing'];
for (const theme of ['normal', 'docs']) for (const width of [320, 768, 1280]) {
  test(`${theme} ${width}px public blog flow fits and passes automated accessibility`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(theme => localStorage.setItem('lsuperagent-color-mode', theme), theme);
    const axe = await readFile(resolve(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
    for (const route of routes) {
      await page.goto(origin + route);
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, font: getComputedStyle(document.body).fontFamily }));
      expect(metrics.scroll, route).toBeLessThanOrEqual(metrics.width + 1);
      expect(metrics.font, route).toContain('Space Grotesk');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if (route === '/home') {
        const bounds = await page.evaluate(() => ({ cube: document.querySelector('.hero-cube').getBoundingClientRect().bottom, text: document.querySelector('.hero-stage .lede').getBoundingClientRect().top }));
        expect(bounds.text).toBeGreaterThanOrEqual(bounds.cube);
      }
      await page.addScriptTag({ content: axe });
      const results = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      expect(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), route).toEqual([]);
    }
  });
}
test('search, category, empty state and reading links work with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin + '/blogs');
  await page.getByRole('searchbox', { name: 'ค้นหาบทความ', exact: true }).fill('CSS');
  await page.getByLabel('ประเภทบทความ').selectOption('til');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.locator('.blog-results .blog-card')).toHaveCount(1);
  await page.locator('.blog-results .blog-card h3 a').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('TIL:');
  await page.goto(origin + '/blogs?q=no-such-topic');
  await expect(page.getByRole('heading', { name: 'ยังไม่พบบทความ' })).toBeVisible();
  await page.getByRole('link', { name: 'ล้างตัวกรอง' }).click();
  await expect(page.locator('.blog-results .blog-card')).toHaveCount(4);
  await context.close();
});
test('article code can be reached by keyboard and themes persist across navigation', async ({ page }) => {
  await page.goto(origin + '/blogs/responses-api-server');
  await page.keyboard.press('Tab');
  await expect(page.locator('.sdk-skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const example = page.locator('pre').first();
  await example.focus();
  expect(await example.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.getByRole('button', { name: /Switch to Docs purple/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'docs');
  await page.goto(origin + '/blogs');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'docs');
});
