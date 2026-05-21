// Probe: confirm #preview's CSS rect doesn't shrink on entering play mode.
// v18 hotfix (36354f1): the launcher's gridW*20 intrinsic resize used to
// drop the canvas ~17% vs the editor's gridW*24. tryPlaytest() now pins
// style.width = gridW*24; this probe asserts the rect stays put.

import { test, expect } from '@playwright/test';

test('preview canvas rect is identical in edit vs play mode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');

  // Wait for the editor's first reflow so the canvas has its intrinsic dims.
  await page.waitForFunction(() => {
    const c = document.querySelector('#preview');
    return c && c.width > 0 && c.height > 0;
  });

  const editRect = await page.locator('#preview').boundingBox();
  const editIntrinsic = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    return { w: c.width, h: c.height };
  });

  // Enter play mode (Ctrl+Cmd+Enter is the keyboard trigger, but the
  // Play button is simpler + matches the spec for the other playtest specs).
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));

  const playRect = await page.locator('#preview').boundingBox();
  const playIntrinsic = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    return { w: c.width, h: c.height };
  });

  // The fix: CSS rect (on-screen size) MUST match. Intrinsic dims are
  // expected to differ — editor draws at TILE=24, engine at TILE=20.
  expect(Math.round(playRect.width)).toBe(Math.round(editRect.width));
  expect(Math.round(playRect.height)).toBe(Math.round(editRect.height));

  // Sanity: intrinsic resolutions DO differ (proves the engine got its
  // own canvas dims; the fix is the CSS pin, not a TILE change).
  expect(playIntrinsic.w).not.toBe(editIntrinsic.w);

  // Surface the numbers in the test output for the transcript.
  // eslint-disable-next-line no-console
  console.log(
    `edit rect ${editRect.width.toFixed(1)}x${editRect.height.toFixed(1)} ` +
      `intrinsic ${editIntrinsic.w}x${editIntrinsic.h}  |  ` +
      `play rect ${playRect.width.toFixed(1)}x${playRect.height.toFixed(1)} ` +
      `intrinsic ${playIntrinsic.w}x${playIntrinsic.h}`,
  );
});
