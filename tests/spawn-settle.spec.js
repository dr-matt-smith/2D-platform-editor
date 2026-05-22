// v22 M1: spawn-fall settle. PlaytestScene.restart() runs no-input
// gravity ticks until the player lands (max 30). Asserts the live
// engine has the player already grounded after Play is pressed on
// a level with a high spawn — no visible fall.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v22: spawn-fall settle — player grounded immediately on Play (high-spawn level)', async ({ page }) => {
  // tutorial.txt-style level: P at row 2 col 4, floor at row 9.
  // 7 rows of falling without v22's settle.
  const level = [
    '########################',
    '#......................#',
    '#...P.............E....#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '########################',
  ].join('\n');
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, level);
  await page.waitForTimeout(400);

  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  // Sample at t=50ms — well before a 7-row fall (~25 frames at 60fps
  // = ~400ms) would complete. With v22's spawn-settle, the player
  // should already be at row 8 (just above the floor).
  await page.waitForTimeout(50);
  // The Player's blue-disc fallback paints at (player.x, player.y);
  // sample the canvas at where row 8 col 4 would be (cell centre
  // x=4*24+12=108, y=8*24+12=204 in editor TILE=24). The canvas
  // intrinsic dims are gridW*20 (engine TILE), so cell (8, 4) centre
  // is at canvas pixel (4*20+10, 8*20+10) = (90, 170).
  // Sample a 3×3 block at cell (8, 4) centre — robust to whether the
  // player paints as a sprite or as the blue-disc fallback. The check
  // is "this pixel is NOT sky"; if the v22 settle didn't run, the
  // player would still be falling through rows 2–5 at t=50ms and this
  // pixel would still show the Dirt sky colour (#1b2a3a ≈ 27,42,58).
  const samples = await page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    const out = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        out.push([...ctx.getImageData(90 + dx, 170 + dy, 1, 1).data]);
      }
    }
    return out;
  });
  // Sky is dark blue-grey at low luminance. Any player paint (sprite
  // or fallback disc) lifts brightness or shifts hue noticeably. Pass
  // if ANY sample in the 5×5 patch is clearly non-sky.
  const nonSky = samples.some(([r, g, b]) => {
    const lum = r + g + b;
    const skyish = Math.abs(r - 27) < 30 && Math.abs(g - 42) < 30 && Math.abs(b - 58) < 30;
    return !skyish && lum > 200;
  });
  expect(nonSky).toBe(true);
});

test('v22: spawn-settle does not break levels where P is already grounded', async ({ page }) => {
  // Trivial 1-row-above-floor level — settle should be a no-op (P
  // lands on frame 1 naturally).
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#####\n#P.E#\n#####');
  await page.waitForTimeout(400);

  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  // Game is ticking; canvas should be paintable.
  await page.waitForTimeout(100);
  const dims = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    return { w: c.width, h: c.height };
  });
  // Intrinsic dims: 5 cols × engine TILE (20) = 100; 3 rows × 20 = 60.
  expect(dims).toEqual({ w: 100, h: 60 });
});
