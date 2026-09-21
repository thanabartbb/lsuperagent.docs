import { test, expect } from '@playwright/test';

const origin = 'https://agents-sdk.space';

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

async function sendTextFlow(page, mode, prompt, timeout = 120000) {
  if (mode !== 'Chat') await page.getByRole('button', { name: mode, exact: true }).click();
  const before = await page.locator('.message.assistant').count();
  await page.getByLabel('ข้อความถึง AI').fill(prompt);
  await page.getByRole('button', { name: 'ส่ง', exact: true }).click();
  await expect(page.locator('.message.assistant')).toHaveCount(before + 1, { timeout });
  const last = page.locator('.message.assistant').last();
  await expect(last).toBeVisible();
  await expect(last.locator('.message-body')).not.toBeEmpty();
  await expect(last.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
  return last;
}

test.describe.configure({ mode: 'serial', timeout: 360000 });

test('desktop public workspace completes all required user flows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('heading', { name: 'สร้างงานด้วย AI' })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  for (const mode of ['Chat', 'Code', 'Image', 'Research', 'Read URL', 'Write']) {
    await expect(page.getByRole('button', { name: mode, exact: true })).toBeVisible();
  }
  const visibleText = await page.locator('body').innerText();
  for (const forbidden of ['Secret DETECTED', 'OPENAI LIVE', 'Provider target', 'PUBLIC SESSION', 'TRUTH ROUTER', 'Development Console', 'Owner workspace']) {
    expect(visibleText).not.toContain(forbidden);
  }

  await sendTextFlow(page, 'Chat', 'ตอบคำเดียวว่า UI_OK');
  await sendTextFlow(page, 'Write', 'เขียนประโยคภาษาไทยสั้น ๆ หนึ่งประโยคเกี่ยวกับการเรียนรู้');

  const largeCode = `ตรวจข้อความโค้ดตัวอย่างนี้และตอบสั้น ๆ ว่าอ่านได้\n${'const value = 1; // padding\n'.repeat(220)}`;
  expect(largeCode.length).toBeGreaterThan(4000);
  await sendTextFlow(page, 'Code', largeCode, 150000);

  const research = await sendTextFlow(page, 'Research', 'ค้นคว้าข่าวเทคโนโลยีล่าสุดหนึ่งเรื่อง สรุปสั้น ๆ และใช้แหล่งอ้างอิงจริง', 180000);
  await expect(research.locator('.source-link').first()).toBeVisible();

  const urlResult = await sendTextFlow(page, 'Read URL', 'อ่าน https://example.com/ แล้วบอกหัวข้อหลักของหน้าเว็บสั้น ๆ', 180000);
  await expect(urlResult.locator('.source-link').first()).toBeVisible();

  await page.getByRole('button', { name: 'Image', exact: true }).click();
  const beforeImages = await page.locator('.image-result').count();
  await page.getByLabel('ข้อความถึง AI').fill('A simple flat blue circle centered on a pure black background, no text, square composition.');
  await page.getByRole('button', { name: 'ส่ง', exact: true }).click();
  await expect(page.locator('.image-result')).toHaveCount(beforeImages + 1, { timeout: 240000 });
  const image = page.locator('.image-result').last();
  await expect(image).toBeVisible();
  const download = page.locator('.message.assistant').last().getByRole('link', { name: 'Download', exact: true });
  await expect(download).toBeVisible();
  const href = await download.getAttribute('href');
  expect(href).toMatch(/^data:image\/png;base64,/);
  expect(href.length).toBeGreaterThan(1000);

  await expect(page.getByText('เสร็จแล้ว', { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('mobile workspace stays inside viewport and keeps primary controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`${origin}/chat`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'สร้างงานด้วย AI' })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const mobileSelect = page.locator('#mobileMode');
  await expect(mobileSelect).toBeVisible();
  await expect(page.locator('.mode-panel')).toBeHidden();
  await mobileSelect.selectOption('research');
  await expect(page.locator('#modeLabel')).toHaveText('Research');

  const bounds = await page.evaluate(() => {
    const ids = ['prompt', 'send', 'mobileMode'];
    return ids.map((id) => {
      const element = document.getElementById(id);
      const rect = element.getBoundingClientRect();
      return { id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
  });
  for (const box of bounds) {
    expect(box.left, `${box.id} left clipped`).toBeGreaterThanOrEqual(-1);
    expect(box.right, `${box.id} right clipped`).toBeLessThanOrEqual(394);
  }

  await expect(page.getByRole('button', { name: 'ส่ง', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ไฟล์ข้อความ', exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
