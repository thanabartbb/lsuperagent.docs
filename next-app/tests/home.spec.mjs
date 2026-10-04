import { expect, test } from '@playwright/test';

test.describe('native Next.js home migration', () => {
  test('renders /home inside the Next.js preview instead of redirecting to production', async ({ page }) => {
    await page.goto('/home');

    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
    await expect(page).toHaveTitle(/Home · SDKSPACE/i);
    await expect(page.getByRole('heading', { name: /Build with SDKSPACE/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Chat/i })).toBeVisible();
  });
});
