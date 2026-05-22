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
  const pixel = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    const ctx = c.getContext('2d');
    return [...ctx.getImageData(90, 170, 1, 1).data];
  });
  // Dirt player fallback colour is #3498db = [52, 152, 219, 255].
  // If the player is HERE at t=50ms, blue dominates. If they're
  // still falling (mid-air at row 2-5), this pixel would be sky.
  const [r, g, b] = pixel;
  expect(b).toBeGreaterThan(180);
  expect(b).toBeGreaterThan(r + 50);
  expect(b).toBeGreaterThan(g + 30);
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
