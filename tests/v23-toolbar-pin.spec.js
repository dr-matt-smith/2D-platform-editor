// v23 M1: toolbar height pin. The edit-mode toolbar holds ~10
// controls (selects + buttons); the play-mode toolbar holds just
// 2 (Restart, Exit). Without a min-height, the row shrinks ~2px
// on enter and the canvas-wrap reclaims those pixels — the canvas
// shifts up. With v23's `.status { min-height: 38px }` the canvas
// origin stays put.
//
// Also: the Play Settings popup has a visible title bar + a
// visible HR between the Viewport and Pickup-Requirement sections.

import { test, expect } from '@playwright/test';

test('v23 M1: canvas top position is identical in edit vs play', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await page.waitForTimeout(200);
  const topEdit = await page.locator('#preview').evaluate((c) =>
    c.getBoundingClientRect().top,
  );
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);
  const topPlay = await page.locator('#preview').evaluate((c) =>
    c.getBoundingClientRect().top,
  );
  // ≤ 1px tolerance for sub-pixel rounding at Retina / 125% zoom.
  expect(Math.abs(topEdit - topPlay)).toBeLessThanOrEqual(1);
});

test('v23 M1: Play Settings popup has title + HR divider', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await page.locator('#playSettingsBtn').click();
  await page.waitForSelector('.play-settings');
  // Title header is present and visible.
  await expect(page.locator('.play-settings .play-settings-header')).toBeVisible();
  await expect(page.locator('.play-settings .play-settings-header')).toContainText(
    'Play Settings',
  );
  // HR divider is present.
  await expect(page.locator('.play-settings hr.popup-divider')).toBeVisible();
  // The HR is positioned between the two <p class="cf-msg"> blocks.
  // DOM order: header → Viewport <p> → ps-rows → HR → Pickup <p> → ps-rows
  const order = await page.evaluate(() => {
    const root = document.querySelector('.play-settings');
    return [...root.children].map((el) => el.className || el.tagName);
  });
  const hrIdx = order.indexOf('popup-divider');
  expect(hrIdx).toBeGreaterThan(0);
  expect(hrIdx).toBeLessThan(order.length - 1);
});
