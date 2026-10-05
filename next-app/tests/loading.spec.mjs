import { test, expect } from '@playwright/test';

test('intro preserves layout, theme persistence, copy, and existing workspace links', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async text => { window.copiedText = text; } } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'React following deveguide by Next.js' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(5, 8, 18)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Switch to Docs purple color mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'docs');
  await page.goto('/loading');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'docs');
  await page.getByRole('button', { name: 'Switch to normal blue-black color mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'normal');
  await page.getByRole('button', { name: 'คัดลอก', exact: true }).click();
  await expect(page.getByRole('button', { name: 'คัดลอกแล้ว', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.copiedText)).toContain("import { Lsupergen }");
  await expect(page.getByRole('link', { name: 'Open Workspace', exact: true })).toHaveAttribute('href', 'https://agents-sdk.space/');
  await expect(page.getByRole('link', { name: 'Open Chat', exact: true })).toHaveAttribute('href', 'https://agents-sdk.space/chat');
  expect(errors).toEqual([]);
});

test('main and intro share content; migrated home is native while remaining workspace routes retain the existing auth boundary', async ({ request }) => {
  const root = await request.get('/', { maxRedirects: 0 });
  expect(root.status()).toBe(200);
  const intro = await request.get('/loading');
  expect(intro.status()).toBe(200);
  expect(await root.text()).toContain('React following');
  expect(await intro.text()).toContain('React following');

  const home = await request.get('/home', { maxRedirects: 0 });
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('Build with');
  expect(await home.text()).toContain('SDKSPACE');

  for (const path of ['/login', '/chat?mode=code', '/docs/installation', '/guide', '/tools', '/keys', '/news']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(`https://agents-sdk.space${path}`);
  }
  const blog = await request.get('/blog', { maxRedirects: 0 });
  expect(blog.headers().location).toBe('https://agents-sdk.space/news');
  const showcase = await request.get('/showcase', { maxRedirects: 0 });
  expect(showcase.headers().location).toBe('/#features');
  expect((await request.get('/api/chat')).status()).toBe(404);
});
