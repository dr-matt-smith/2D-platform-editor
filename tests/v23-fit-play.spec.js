// v23 M4: Fit-to-screen in Play / Test. The editor's Fit toggle
// (#fitBtn) now propagates into Play mode — the v18 CSS pin
// formula multiplies by min(availW/cssW, availH/cssH) when fit is
// on, so the canvas grows to fill the wrap instead of sitting at
// its intrinsic pinCells*TILE size.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v23 M4: Fit on → Play canvas scales to wrap (wider than intrinsic)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Small level — its intrinsic editor-CSS width (10 cols × 24 = 240 px)
  // is much narrower than the canvas-wrap, so Fit will scale UP.
  await injectLevel(page, '##########\n#P......E#\n##########');
  await page.waitForTimeout(200);
  // Turn Fit on.
  await page.locator('#fitBtn').click();
  await expect(page.locator('#fitBtn')).toHaveClass(/active/);
  const editWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  expect(editWidth).toBeGreaterThan(240);

  // Enter Play.
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(150);
  const playWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  // Play canvas should also be substantially wider than intrinsic
  // — fit scaled it up.
  expect(playWidth).toBeGreaterThan(240);

  // Exit play — restored.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);
  const restoredWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  expect(restoredWidth).toBeGreaterThan(240);
});

test('v23 M4: Fit off → Play canvas at intrinsic pinCells*TILE', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '##########\n#P......E#\n##########');
  await page.waitForTimeout(200);
  // Ensure Fit is OFF.
  const isActive = await page.locator('#fitBtn').evaluate((b) => b.classList.contains('active'));
  if (isActive) await page.locator('#fitBtn').click();
  // Enter Play.
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(150);
  const playWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  // 10 cells × editor TILE (24) = 240 px — the v18 byte-identical pin.
  expect(playWidth).toBe(240);
});

test('v23 M4: Test mode rAF-defers the re-fit', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  // Turn Fit on so the rAF defer has something to do.
  const isActive = await page.locator('#fitBtn').evaluate((b) => b.classList.contains('active'));
  if (!isActive) await page.locator('#fitBtn').click();
  const beforeWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  // Click Test — wait for the agent dialog to open.
  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog');
  // testmode is set; legend column collapsed → wrap got wider.
  await expect(page.locator('body')).toHaveClass(/testmode/);
  await page.waitForTimeout(80); // wait past the rAF tick
  // Canvas was re-fit; width must be ≥ the pre-Test width (legend
  // collapse freed pixels).
  const afterWidth = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  expect(afterWidth).toBeGreaterThanOrEqual(beforeWidth);
});
