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

test('v23 fixup: toolbar height pin survives wrapped toolbar (narrow viewport)', async ({ page }) => {
  // Force a wrapped edit-mode toolbar by setting a narrow viewport.
  // At 700px wide the 10+ controls + selects can't all fit on one row,
  // so the toolbar grows to 2+ rows. Entering Play (only Restart +
  // Exit visible) must NOT shrink the toolbar — that would jump the
  // canvas.
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/');
  await page.waitForSelector('#preview');
  await page.waitForTimeout(300);
  const toolbarH0 = await page.locator('.pane.right > .status').evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  // Sanity check: toolbar wrapped (more than the base 40px floor).
  expect(toolbarH0).toBeGreaterThan(48);
  const top0 = await page.locator('#preview').evaluate(
    (c) => c.getBoundingClientRect().top,
  );
  // Enter Play.
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);
  const toolbarH1 = await page.locator('.pane.right > .status').evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  const top1 = await page.locator('#preview').evaluate(
    (c) => c.getBoundingClientRect().top,
  );
  // The pinned height must match the recorded edit-mode height
  // (± 1px sub-pixel rounding).
  expect(Math.abs(toolbarH1 - toolbarH0)).toBeLessThanOrEqual(1);
  // Canvas top must stay put.
  expect(Math.abs(top1 - top0)).toBeLessThanOrEqual(1);
  // Inline minHeight must be set on the toolbar.
  const inlineMinH = await page.locator('.pane.right > .status').evaluate(
    (el) => el.style.minHeight,
  );
  expect(inlineMinH).toMatch(/\d+px/);
  // Exit → inline minHeight cleared, toolbar can re-wrap naturally.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('playmode'));
  await page.waitForTimeout(80);
  const afterExitInline = await page.locator('.pane.right > .status').evaluate(
    (el) => el.style.minHeight,
  );
  expect(afterExitInline).toBe('');
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
