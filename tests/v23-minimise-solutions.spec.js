// v23 M5: minimisable agent dialog. The success state has a `[—]`
// button in the header; clicking it swaps the full dialog for a
// thin floating bar at the top of the wrap. Backdrop becomes
// transparent + click-through so the path overlay stays visible.
// Demo / Expand / Close are all wired in the minimised bar.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function clearPref(page) {
  await page.evaluate(() => localStorage.removeItem('v23.dialogMinimised'));
}

test('v23 M5: [—] collapses the dialog and reveals the path overlay', async ({ page }) => {
  await page.goto('/');
  await clearPref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  // Full dialog visible.
  await expect(page.locator('.agent-dialog')).toBeVisible();
  // Click minimise.
  await page.locator('.agent-min-btn[data-act="minimise"]').click();
  // Full dialog gone; minimised bar in.
  await expect(page.locator('.agent-dialog')).toHaveCount(0);
  await expect(page.locator('.minimised-solutions')).toBeVisible();
  // Backdrop has the dialog-minimised class.
  await expect(page.locator('.modal-backdrop')).toHaveClass(/dialog-minimised/);
  // Reset for next test.
  await page.locator('.minimised-solutions [data-act="close"]').click();
});

test('v23 M5: [↕ Expand] in minimised bar restores the full dialog', async ({ page }) => {
  await page.goto('/');
  await clearPref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  await page.locator('.agent-min-btn[data-act="minimise"]').click();
  await expect(page.locator('.minimised-solutions')).toBeVisible();
  await page.locator('.minimised-solutions [data-act="expand"]').click();
  await expect(page.locator('.agent-dialog')).toBeVisible();
  await expect(page.locator('.minimised-solutions')).toHaveCount(0);
  // Reset.
  await page.locator('.cf-btn[data-act="close"]').click();
});

test('v23 M5: minimised state persists across reload', async ({ page }) => {
  await page.goto('/');
  await clearPref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  await page.locator('.agent-min-btn[data-act="minimise"]').click();
  await expect(page.locator('.minimised-solutions')).toBeVisible();
  // Close, reopen — minimised choice should be remembered.
  await page.locator('.minimised-solutions [data-act="close"]').click();
  await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  // Opens DIRECTLY into minimised mode.
  await expect(page.locator('.minimised-solutions')).toBeVisible();
  await expect(page.locator('.agent-dialog')).toHaveCount(0);
  // Reset state.
  await page.locator('.minimised-solutions [data-act="expand"]').click();
  await page.locator('.cf-btn[data-act="close"]').click();
  await page.evaluate(() => localStorage.removeItem('v23.dialogMinimised'));
});

test('v23 M5: Demo button in minimised bar replays the recording', async ({ page }) => {
  await page.goto('/');
  await clearPref(page);
  await page.reload();
  await page.waitForSelector('#preview');
  await injectLevel(page, '#####\n#P.E#\n#####');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  await page.locator('.agent-min-btn[data-act="minimise"]').click();
  await page.locator('.minimised-solutions [data-act="demo"]').click();
  // Demo enters demomode (the existing v20 behaviour).
  await page.waitForFunction(
    () => document.body.classList.contains('demomode'),
    { timeout: 3000 },
  );
});
