// v23 M2: light/dark theme toggle. `body.lightmode` re-binds five
// CSS custom properties (--bg/--fg/--line/--dim/--accent); the
// 🌗 toolbar button flips it. User choice is persisted in
// localStorage and restored on reload.
//
// v24 M2: first-load default now tracks OS prefers-color-scheme.
// Each test in this file emulates dark-OS up front so the
// "initial state is dark" precondition holds regardless of the
// CI host's default. The v24-theme-os-default.spec.js suite is
// the actual coverage for the OS-tracking behaviour.

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
});

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

test('v23 M2: Play Settings number inputs flip to light bg in lightmode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Switch to lightmode.
  const cls0 = await page.locator('body').evaluate((b) => b.className);
  if (!cls0.includes('lightmode')) await page.locator('#themeBtn').click();
  // Open Play Settings; the popup mounts the three number inputs.
  await page.locator('#playSettingsBtn').click();
  await page.waitForSelector('.play-settings');
  // ps-vw and ps-vh are visible by default (Viewport row); ps-n
  // only when "At least" radio is checked. We just need them in the
  // DOM and rendered.
  for (const id of ['#ps-vw', '#ps-vh']) {
    const bg = await page.locator(id).evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    // Pale (each RGB channel > 200).
    expect(RGB(bg)[0]).toBeGreaterThan(200);
  }
  // Now flip the radio so #ps-n is visible too.
  await page.locator('input[name="ps-pickups"][value="min"]').click();
  const psNBg = await page.locator('#ps-n').evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  expect(RGB(psNBg)[0]).toBeGreaterThan(200);
  // Close + reset theme.
  await page.locator('.play-settings [data-act="cancel"]').click();
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
