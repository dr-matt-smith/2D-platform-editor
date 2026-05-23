// v26 M1: new CSS custom properties added at :root + body.lightmode.
// M2 will substitute them into the rules. M1 just asserts the vars
// resolve to the expected values pre/post theme toggle — the cascade
// infrastructure is in place for M2 to plug into.

import { test, expect } from '@playwright/test';

const EXPECT_DARK = {
  '--ctl-bg':          '#333',
  '--ctl-hover':       '#3d3d40',
  '--input-bg':        '#1d1d20',
  '--row-hover':       '#2d2d30',
  '--focus-tint':      '#1e3b29',
  '--focus-border':    '#6cd99a',
  '--badge-ok-bg':     '#1e3b29',
  '--badge-ok-fg':     '#6cd99a',
  '--badge-fail-bg':   '#3b1e1e',
  '--badge-fail-fg':   '#ff8c8c',
  '--badge-search-bg': '#2a2d3a',
  '--badge-search-fg': '#c8c8e0',
};

const EXPECT_LIGHT = {
  '--ctl-bg':          '#e0e0e0',
  '--ctl-hover':       '#d2d2d2',
  '--input-bg':        '#ffffff',
  '--row-hover':       '#ececec',
  '--focus-tint':      '#d8f0e0',
  '--focus-border':    '#1e7e34',
  '--badge-ok-bg':     '#d8f0e0',
  '--badge-ok-fg':     '#1e7e34',
  '--badge-fail-bg':   '#f2d0d0',
  '--badge-fail-fg':   '#b22222',
  '--badge-search-bg': '#fff3cd',
  '--badge-search-fg': '#856404',
};

test('v26 M1: custom properties resolve to dark values in default theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.waitForSelector('#preview');
  await page.evaluate(() => localStorage.removeItem('v23.theme'));
  await page.reload();
  await page.waitForSelector('#preview');
  const resolved = await page.evaluate((keys) => {
    // Read from body — `body.lightmode` rebinds happen at body
    // scope, so :root only sees the dark defaults. body inherits
    // the dark from :root in dark mode, then overrides in light.
    const cs = getComputedStyle(document.body);
    const out = {};
    for (const k of keys) out[k] = cs.getPropertyValue(k).trim();
    return out;
  }, Object.keys(EXPECT_DARK));
  for (const [k, expected] of Object.entries(EXPECT_DARK)) {
    expect(resolved[k].toLowerCase()).toBe(expected.toLowerCase());
  }
});

test('v26 M1: custom properties resolve to light values under lightmode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Force lightmode regardless of OS pref.
  await page.evaluate(() => {
    localStorage.setItem('v23.theme', 'light');
  });
  await page.reload();
  await page.waitForSelector('#preview');
  await expect(page.locator('body')).toHaveClass(/lightmode/);
  const resolved = await page.evaluate((keys) => {
    const cs = getComputedStyle(document.body);
    const out = {};
    for (const k of keys) out[k] = cs.getPropertyValue(k).trim();
    return out;
  }, Object.keys(EXPECT_LIGHT));
  for (const [k, expected] of Object.entries(EXPECT_LIGHT)) {
    expect(resolved[k].toLowerCase()).toBe(expected.toLowerCase());
  }
  // Cleanup for the next test.
  await page.evaluate(() => localStorage.removeItem('v23.theme'));
});
