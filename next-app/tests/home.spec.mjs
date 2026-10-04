import { expect, test } from '@playwright/test';

test.describe('native Next.js home migration', () => {
  test('renders /home full-width without the developer badge', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');

    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
    await expect(page).toHaveTitle(/Home · SDKSPACE/i);
    await expect(page.getByRole('heading', { name: /Build with SDKSPACE/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Chat/i })).toBeVisible();
    await expect(page.getByText('BUILT FOR DEVELOPERS', { exact: true })).toHaveCount(0);

    const shell = page.locator('.home-phone');
    const box = await shell.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(390);
    await expect(shell).toHaveCSS('border-radius', '0px');
    await expect(shell).toHaveCSS('border-top-width', '0px');
  });
});
