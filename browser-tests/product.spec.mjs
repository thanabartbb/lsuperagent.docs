import { test, expect } from '@playwright/test';

const publicOrigin = 'https://agents-sdk.space';

test.use({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  locale: 'th-TH',
  timezoneId: 'Asia/Bangkok',
});

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyBg).toBe('rgb(0, 0, 0)');
  expect(metrics.bodyColor).toBe('rgb(255, 255, 255)');
}

async function assertLockedLogin(page) {
  await expect(page.getByRole('heading', { name: 'LSUPERAGENT SDK' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'เข้าสู่ระบบด้วย Google' })).toHaveAttribute('href', '/auth/google?return_to=/chat');
  const visibleText = await page.locator('body').innerText();
  for (const forbidden of ['Guest', 'ทดลองแชท', 'Development Console', 'Continue with GitHub', 'Continue with Email']) expect(visibleText).not.toContain(forbidden);
}

test.describe.configure({ mode: 'serial', timeout: 60000 });

test('public root opens the locked login entry', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const response = await page.goto(`${publicOrigin}/`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/login');
  await assertLockedLogin(page);
  await assertNoHorizontalOverflow(page);
});

test('workspace redirects anonymous visitors back to the locked login and remains mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const response = await page.goto(`${publicOrigin}/chat`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  const location = new URL(page.url());
  expect(location.pathname).toBe('/login');
  expect(location.searchParams.get('return_to')).toBe('/chat');
  await assertLockedLogin(page);
  await assertNoHorizontalOverflow(page);
});
