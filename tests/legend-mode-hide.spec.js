// v22 M5: hide the legend in Play, Demo, and Test (agent) modes.
// In edit mode the legend is visible; entering any of the three
// active modes hides it, and exiting restores it.

import { test, expect } from '@playwright/test';

function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v22 M5: legend hidden during Play mode, restored on exit', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#####\n#P.E#\n#####');
  await page.waitForTimeout(200);
  // Visible in edit mode.
  await expect(page.locator('.pane.right > .legend')).toBeVisible();
  // Enter play.
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await expect(page.locator('.pane.right > .legend')).toBeHidden();
  // Exit via Esc.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('playmode'));
  await expect(page.locator('.pane.right > .legend')).toBeVisible();
});

test('v22 M5: legend hidden during Test (agent) mode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await expect(page.locator('.pane.right > .legend')).toBeVisible();
  // Open agent dialog.
  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog');
  await expect(page.locator('.pane.right > .legend')).toBeHidden();
  // Close dialog → legend back.
  await page.locator('.cf-btn[data-act="close"]').click();
  await page.waitForSelector('.agent-dialog', { state: 'detached' });
  await expect(page.locator('.pane.right > .legend')).toBeVisible();
});

test('v22 M5: fit button also hides during Play/Test modes', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#####\n#P.E#\n#####');
  await page.waitForTimeout(200);
  await expect(page.locator('#fitBtn')).toBeVisible();
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await expect(page.locator('#fitBtn')).toBeHidden();
});
