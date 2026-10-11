import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
let server, origin;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/auth/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) && file !== resolve(root, 'home.html')) {
      res.writeHead(403); res.end(); return;
    }
    try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(bytes); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

for (const mode of ['normal', 'docs']) {
  for (const width of [320, 393, 600, 839, 840, 1280]) {
    test(mode + ' home fits ' + width + 'px and keeps its actual font and actions', async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(mode => localStorage.setItem('lsuperagent-color-mode', mode), mode);
      await page.goto(origin + '/home.html');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/SDKSPACE/);
      await expect(page.getByRole('link', { name: 'Quickstart', exact: true })).toHaveAttribute('href', '/docs/quickstart');
      await expect(page.locator('.cta-row .btn-primary')).toHaveAttribute('href', '/tools');
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        shell: document.querySelector('.phone').getBoundingClientRect().width,
        font: getComputedStyle(document.body).fontFamily,
        latinLoaded: document.fonts.check('16px "Space Grotesk"'),
        gridColumns: getComputedStyle(document.querySelector('.grid2')).gridTemplateColumns.split(' ').length,
        lede: document.querySelector('.lede').getBoundingClientRect().width,
      }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport + 1);
      expect(metrics.shell).toBeGreaterThanOrEqual(width - 1);
      expect(metrics.font).toContain('Space Grotesk');
      expect(metrics.latinLoaded).toBe(true);
      expect(metrics.gridColumns).toBe(width < 480 ? 1 : 2);
      const toggle = page.getByRole('button', { name: 'Open navigation' });
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      expect(outline).not.toBe('none');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
      await page.getByRole('link', { name: 'Quickstart', exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('link', { name: 'Quickstart', exact: true })).toBeFocused();
    });
  }
}
test('reduced motion uses the static cube poster and stops decoration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/home.html');
  const state = await page.evaluate(() => ({
    strip: getComputedStyle(document.querySelector('.top-strip')).animationName,
    dome: getComputedStyle(document.querySelector('.dome-glow')).display,
    cube: document.querySelector('.hero-cube img').currentSrc,
  }));
  expect(state.strip).toBe('none');
  expect(state.dome).toBe('none');
  expect(state.cube).toContain('sdkspace-cube-hero-poster.webp');
});
