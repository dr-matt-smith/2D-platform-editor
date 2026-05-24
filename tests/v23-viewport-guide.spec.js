// v23 M3: viewport bounding rectangle. When `# viewport: WxH` is
// set, the editor's #overlay paints a dashed yellow rectangle
// centred on the player spawn (or geometric centre, fallback).
// Editor-only — vanishes in Play / Demo / Test.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

// A 16-wide × 10-tall level with a 6-wide × 4-tall viewport. With
// editor TILE=24, the world canvas is 384×240, the viewport rect is
// 144×96. P sits at column 4, row 4 → centred viewport runs from
// (col 1.5, row 2.5) → clamped to (col 1, row 2) when integer pixels.
const LEVEL = [
  '# viewport: 6x4',
  '################',
  '#..............#',
  '#..............#',
  '#..............#',
  '#...P..........#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#.............E#',
  '################',
].join('\n');

test('v23 M3: dashed-yellow rectangle drawn on #overlay when viewport set', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, LEVEL);
  await page.waitForTimeout(300);

  // Sample a pixel that should be ON the dashed stroke. The rect
  // starts at x≈ (4 - 3)*24 + 1 = 25, y≈ (4 - 2)*24 + 1 + HUD = 73.
  // (v27 M2: overlay paints guide offset by HUD_HEIGHT = 24.)
  // Walk a few pixels along the top edge looking for yellow alpha.
  const topEdgeSamples = await page.evaluate(() => {
    const ctx = document.querySelector('#overlay').getContext('2d');
    const samples = [];
    for (let x = 24; x < 170; x += 2) {
      for (let y = 71; y <= 76; y++) {
        const px = ctx.getImageData(x, y, 1, 1).data;
        if (px[3] > 0) samples.push([x, y, px[0], px[1], px[2], px[3]]);
      }
    }
    return samples;
  });
  // Some yellow-ish pixel must exist on the top edge.
  const yellowOnTop = topEdgeSamples.some(
    ([, , r, g, b]) => r > 200 && g > 150 && b < 200,
  );
  expect(yellowOnTop).toBe(true);

  // Interior pixel — well inside the rect — must be CLEAR (just an outline).
  const interior = await page.evaluate(() => {
    const ctx = document.querySelector('#overlay').getContext('2d');
    // Centre of viewport rect ≈ (96, 96 + HUD = 120). Far from any edge.
    return [...ctx.getImageData(96, 120, 1, 1).data];
  });
  expect(interior[3]).toBe(0);
});

test('v23 M3: no rectangle when viewport unset', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, LEVEL.replace('# viewport: 6x4\n', ''));
  await page.waitForTimeout(300);
  // Scan a broad swath; expect every pixel to be transparent (the
  // editor overlay is only used for marquee/rect-draw + this guide;
  // no drag is in progress).
  const anyNonZero = await page.evaluate(() => {
    const ctx = document.querySelector('#overlay').getContext('2d');
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  });
  expect(anyNonZero).toBe(false);
});

test('v23 M3: viewport guide hidden in Play mode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, LEVEL);
  await page.waitForTimeout(300);
  // Verify guide is present in edit mode. v27 M2: guide y offset by HUD_HEIGHT = 24.
  const editGuide = await page.evaluate(() => {
    const ctx = document.querySelector('#overlay').getContext('2d');
    const px = ctx.getImageData(50, 73, 1, 1).data;
    return px[3] > 0;
  });
  expect(editGuide).toBe(true);
  // Enter play.
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);
  // Overlay is detached / blank in play mode; the guide must NOT paint.
  const playGuide = await page.evaluate(() => {
    const ctx = document.querySelector('#overlay').getContext('2d');
    const px = ctx.getImageData(50, 73, 1, 1).data;
    return px[3] > 0;
  });
  expect(playGuide).toBe(false);
});
