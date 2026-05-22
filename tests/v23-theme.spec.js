// v23 M2: light/dark theme toggle. `body.lightmode` re-binds five
// CSS custom properties (--bg/--fg/--line/--dim/--accent); the
// 🌗 toolbar button flips it. Initial state is dark (the v22-and-
// earlier default); user choice is persisted in localStorage and
// restored on reload.

import { test, expect } from '@playwright/test';

const RGB = (s) => s.replace(/[^\d,]/g, '').split(',').map(Number);

test('v23 M2: initial state is dark; #themeBtn flips to light', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Initial: no lightmode class; bg colour is the dark #1e1e1e.
  await expect(page.locator('body')).not.toHaveClass(/lightmode/);
  const darkBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  // r,g,b all ~30 (dark).
  expect(RGB(darkBg)[0]).toBeLessThan(50);
  // Click the toggle.
  await page.locator('#themeBtn').click();
  await expect(page.locator('body')).toHaveClass(/lightmode/);
  const lightBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  // r,g,b all > 200 (pale).
  expect(RGB(lightBg)[0]).toBeGreaterThan(200);
});

test('v23 M2: theme choice survives reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Switch to light.
  await page.locator('#themeBtn').click();
  await expect(page.locator('body')).toHaveClass(/lightmode/);
  // Reload.
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).toHaveClass(/lightmode/);
  // Reset for next test.
  await page.locator('#themeBtn').click();
});

test('v23 M2: toolbar selects flip to light bg in lightmode (specificity fix)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Ensure we start dark.
  const cls0 = await page.locator('body').evaluate((b) => b.className);
  if (cls0.includes('lightmode')) await page.locator('#themeBtn').click();
  // Dark mode: selects are dark.
  const darkSelectBg = await page.locator('#tilesetSel').evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  expect(RGB(darkSelectBg)[0]).toBeLessThan(80); // dark grey
  // Flip to light.
  await page.locator('#themeBtn').click();
  const lightSelectBg = await page.locator('#tilesetSel').evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  // Pale (each channel > 200).
  expect(RGB(lightSelectBg)[0]).toBeGreaterThan(200);
  // Also assert the levelSel — same rule covers both.
  const levelBg = await page.locator('#levelSel').evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  expect(RGB(levelBg)[0]).toBeGreaterThan(200);
  // Reset.
  await page.locator('#themeBtn').click();
});

test('v23 M2: button title reflects current state', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Dark mode initial title invites going to light.
  await expect(page.locator('#themeBtn')).toHaveAttribute('title', /dark.*click for light/i);
  await page.locator('#themeBtn').click();
  await expect(page.locator('#themeBtn')).toHaveAttribute('title', /light.*click for dark/i);
  // Reset.
  await page.locator('#themeBtn').click();
});
