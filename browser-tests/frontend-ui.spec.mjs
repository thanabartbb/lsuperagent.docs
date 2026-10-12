import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicResource } from '../src/public-resources.js';
import { NAV } from '../assets/docs-nav.js';

// Local API fixtures exercise presentation only; no provider calls or real credentials.
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const publicPages = ['/', '/developers', '/about', '/contact', '/privacy'];
const staticPages = ['home', 'loading', 'tools', 'guide', 'news', 'exa', 'keys', 'login', 'signup', 'forgot-password', 'dev', 'dev-code-drop', 'chat'];
const docsPages = NAV.flatMap(group => group.pages.map(page => '/docs/' + page.slug));
const pages = [...publicPages, ...staticPages.map(page => '/' + page), ...docsPages];
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
let server, origin;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/') || pathname.startsWith('/v1/')) {
      const payload = pathname === '/api/auth/session'
        ? { authenticated: true, owner_google: false, user: { email: 'test@example.com' } }
        : pathname === '/api/github/status' ? { ok: true, connected: false }
        : pathname === '/api/feed' ? { items: [], fetchedAt: Date.now(), errors: [] }
        : { ok: true, conversations: [], providers: [], results: [] };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }
    if (publicPages.includes(pathname)) {
      const response = publicResource(new Request('http://localhost' + pathname), pathname);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const route = pathname.startsWith('/docs/') ? '/docs-shell.html'
      : pathname.startsWith('/docs-content/') && !extname(pathname) ? pathname + '.html'
      : staticPages.includes(pathname.slice(1)) ? pathname + '.html' : pathname;
    const file = resolve(root, '.' + route);
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

for (const theme of ['normal', 'docs']) for (const width of [320, 393, 768, 1280]) {
  for (const route of pages) test(`${theme} ${width}px ${route} has readable content without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('lsuperagent-color-mode', theme), theme);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + route);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('main')).toBeVisible();
    if (route === '/chat') await expect(page.locator('main')).toHaveAccessibleName('SDKSPACE Chat');
    else await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (route.startsWith('/docs/')) await expect(page.locator('#content')).toHaveAttribute('aria-busy', 'false');
    const metrics = await page.evaluate(() => ({
      width: innerWidth, scroll: document.documentElement.scrollWidth,
      family: getComputedStyle(document.body).fontFamily,
      latin: document.fonts.check('16px "Space Grotesk"'),
      thai: document.fonts.check('16px "Noto Sans Thai"'),
      mode: document.documentElement.dataset.theme,
      overflowCauses: document.documentElement.scrollWidth > innerWidth + 1 ? [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && r.right > innerWidth + 1;
      }).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })) : [],
    }));
    expect(metrics.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.family).toContain('Space Grotesk');
    expect(metrics.latin).toBe(true);
    expect(metrics.thai).toBe(true);
    expect(metrics.mode).toBe(theme);
    expect(errors).toEqual([]);
  });
}

test('workspace menu supports keyboard, focus return, outside click and desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 });
  await page.goto(origin + '/tools');
  const toggle = page.getByRole('button', { name: 'เปิดเมนู' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const mobile = page.getByRole('navigation', { name: 'เมนูมือถือ' });
  await expect(mobile).toBeVisible();
  await expect(mobile.getByRole('link', { name: 'Tools', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(mobile).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('main h1').click();
  await expect(mobile).toBeHidden();
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(page.locator('#shell-mobile-panel')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toBeVisible();
});

for (const width of [320, 768, 1024, 1099, 1100]) test(`workspace navigation is usable at the ${width}px breakpoint`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto(origin + '/tools');
  if (width < 1100) {
    await page.getByRole('button', { name: 'เปิดเมนู' }).click();
    await expect(page.getByRole('navigation', { name: 'เมนูมือถือ' })).toBeVisible();
  } else await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toBeVisible();
  const clipped = await page.locator('.sdk-workspace-header').evaluate(header => [...header.querySelectorAll('a,button')].filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > innerWidth + 1 || rect.height < 48);
  }).map(el => el.textContent));
  expect(clipped).toEqual([]);
});

test('guide runtime tabs use arrows, Home and End with one tab stop', async ({ page }) => {
  await page.goto(origin + '/guide');
  const tabs = page.getByRole('tablist', { name: 'ตัวอย่างตาม runtime' });
  await tabs.getByRole('tab', { name: 'Node.js (ESM)' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'CommonJS' })).toBeFocused();
  await expect(page.locator('#runtime-panel-cjs')).toBeVisible();
  await expect(page.locator('#runtime-panel-node')).toBeHidden();
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: 'curl', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tabs.getByRole('tab', { name: 'Node.js (ESM)' })).toBeFocused();
  await expect(tabs.locator('[tabindex="0"]')).toHaveCount(1);
});

test('news tabs navigate by keyboard and keep loading state until the latest response', async ({ page }) => {
  let release;
  await page.route('**/api/feed?source=openai', async route => {
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { items: [], errors: [] } });
  });
  await page.goto(origin + '/news');
  await page.getByRole('tab', { name: 'ทั้งหมด' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'OpenAI', exact: true })).toBeFocused();
  await expect(page.locator('#news-list')).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => typeof release).toBe('function');
  release();
  await expect(page.locator('#news-list')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#news-list')).toContainText('ยังไม่มีข่าวจากแหล่งนี้');
});

test('account fields keep labels, toggle password and prevent duplicate pending submissions', async ({ page }) => {
  let requests = 0, release;
  await page.route('**/api/auth/platform/login', async route => {
    requests++;
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: 401, json: { ok: false, message: 'ลองใหม่' } });
  });
  await page.goto(origin + '/login');
  await page.getByLabel('อีเมล', { exact: true }).fill('test@example.com');
  const password = page.getByLabel('รหัสผ่าน', { exact: true });
  await password.fill('dummy-test-password');
  const show = page.getByRole('button', { name: 'แสดงรหัสผ่าน', exact: true });
  await show.click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'ซ่อนรหัสผ่าน', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  const submit = page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true });
  await submit.click();
  await expect(submit).toBeDisabled();
  await password.press('Enter');
  await expect.poll(() => requests).toBe(1);
  expect(requests).toBe(1);
  release();
  await expect(submit).toBeEnabled();
  await expect(page.locator('#auth-notice')).toHaveAttribute('data-state', 'error');
});

test('password reset validates email before requesting a reset', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/platform/password-reset', async route => { requests++; await route.fulfill({ json: { ok: true } }); });
  await page.goto(origin + '/forgot-password');
  await page.getByLabel('อีเมล', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: 'ส่งลิงก์รีเซ็ตรหัสผ่าน' }).click();
  expect(requests).toBe(0);
  await expect(page.getByLabel('อีเมล', { exact: true })).toBeFocused();
});

for (const state of ['success', 'empty', 'error']) test(`Exa ${state} keeps the request contract and shows its result state`, async ({ page }) => {
  let body, release;
  await page.route('**/api/exa/search', async route => {
    body = route.request().postDataJSON();
    await new Promise(resolve => { release = resolve; });
    await route.fulfill(state === 'error'
      ? { status: 502, json: { ok: false, message: 'บริการค้นหาไม่ตอบกลับ' } }
      : { json: { ok: true, results: state === 'empty' ? [] : [
        { title: 'Example result', url: 'https://example.com/reference', highlights: ['Source text'] },
        { title: 'Unsafe result', url: 'javascript:alert(1)', highlights: [] },
      ] } });
  });
  await page.goto(origin + '/exa');
  await page.getByLabel('คำค้นหา', { exact: true }).fill('  SDKSPACE  ');
  const button = page.getByRole('button', { name: 'ค้นหา', exact: true });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.locator('#exa-results')).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => body).toEqual({ query: 'SDKSPACE', numResults: 5 });
  release();
  await expect(button).toBeEnabled();
  await expect(page.locator('#exa-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#exa-status')).toHaveText(state === 'success' ? 'พบ 1 ผลลัพธ์' : state === 'empty' ? 'ไม่พบผลลัพธ์' : 'บริการค้นหาไม่ตอบกลับ');
  if (state === 'success') await expect(page.locator('#exa-results a')).toHaveAttribute('href', 'https://example.com/reference');
});

test('docs search has a visible close button, keyboard focus trap and restores the opener', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 });
  await page.goto(origin + '/docs/introduction');
  const opener = page.getByRole('button', { name: 'ค้นหา (Ctrl+K)' });
  await opener.click();
  const input = page.getByRole('searchbox', { name: 'ค้นหาเอกสาร' });
  await expect(input).toBeFocused();
  await input.fill('quickstart');
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#search-results a').first()).toHaveAttribute('href', '/docs/quickstart');
  await page.getByRole('button', { name: 'ปิด', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#search-results a').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('.layout')).not.toHaveJSProperty('inert', true);
});

test('docs search never renders an older query after its index finishes loading', async ({ page }) => {
  let release;
  await page.route('**/docs-content/quickstart', async route => {
    await new Promise(resolve => { release = resolve; });
    await route.continue();
  });
  await page.goto(origin + '/docs/introduction');
  await page.getByRole('button', { name: 'ค้นหา (Ctrl+K)' }).click();
  const input = page.getByRole('searchbox', { name: 'ค้นหาเอกสาร' });
  await input.fill('quickstart');
  await input.fill('zzzz-unmatched-query');
  await expect.poll(() => typeof release).toBe('function');
  release();
  await expect(page.locator('#search-results')).toHaveText('ไม่พบผลลัพธ์');
});

test('reduced motion applies across home, introduction and workspace', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of ['/home', '/loading', '/tools', '/guide']) {
    await page.goto(origin + route);
    const active = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => {
      const css = getComputedStyle(el);
      return css.animationName !== 'none' || (css.transitionDuration !== '0s' && css.transitionProperty !== 'none');
    }).map(el => el.className));
    expect(active).toEqual([]);
    if (route === '/home' || route === '/loading') await expect(page.locator('.hero-cube img')).toHaveJSProperty('currentSrc', origin + '/assets/sdkspace-cube-hero-poster.webp');
  }
});

for (const theme of ['normal', 'docs']) for (const route of pages) test(`accessibility ${theme} ${route} passes automated WCAG checks`, async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 });
  await page.addInitScript(theme => localStorage.setItem('lsuperagent-color-mode', theme), theme);
  await page.goto(origin + route);
  await page.evaluate(() => document.fonts.ready);
  if (route.startsWith('/docs/')) await expect(page.locator('#content')).toHaveAttribute('aria-busy', 'false');
  await page.addScriptTag({ path: resolve(root, 'node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  });
  expect(violations).toEqual([]);
});

test('primary button text passes contrast after the full CSS cascade in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['normal', 'docs']) {
    await page.addInitScript(theme => localStorage.setItem('lsuperagent-color-mode', theme), theme);
    for (const route of ['/home', '/login', '/signup', '/forgot-password', '/tools', '/exa']) {
      await page.goto(origin + route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(() => document.fonts.ready);
      const contrasts = await page.locator('.btn-primary, .exa-form button, button.go').evaluateAll(buttons => {
        const luminance = rgb => {
          const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return values.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        };
        return buttons.filter(button => !button.hidden).map(button => {
          const css = getComputedStyle(button);
          const foreground = luminance(css.color), background = luminance(css.backgroundColor);
          return { text: button.textContent, image: css.backgroundImage, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
        });
      });
      for (const result of contrasts) {
        expect(result.image, route + ' ' + result.text).toBe('none');
        expect(result.ratio, theme + ' ' + route + ' ' + result.text).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
