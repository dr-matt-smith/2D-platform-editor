// v24 M2: first-load theme follows the OS `prefers-color-scheme`
// when no `v23.theme` localStorage entry exists. Once the user
// clicks 🌗 (theme stored), their choice wins regardless of OS pref.

import { test, expect } from '@playwright/test';

async function clearThemePref(page) {
  await page.evaluate(() => localStorage.removeItem('v23.theme'));
}

test('v24 M2: light-OS + no localStorage → first load is lightmode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearThemePref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).toHaveClass(/lightmode/);
});

test('v24 M2: dark-OS + no localStorage → first load stays dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearThemePref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).not.toHaveClass(/lightmode/);
});

test('v24 M2: user choice locks once 🌗 is clicked (overrides OS pref)', async ({ page }) => {
  // Start with light OS — would default to lightmode if unset.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearThemePref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).toHaveClass(/lightmode/);
  // User clicks 🌗 — flips to dark.
  await page.locator('#themeBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/lightmode/);
  // Reload — even though OS is still light, the user's dark choice
  // wins (localStorage was written).
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).not.toHaveClass(/lightmode/);
  // Cleanup for the next test.
  await clearThemePref(page);
});
