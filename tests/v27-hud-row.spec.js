// v27 M3: HUD-band rendering. The reserved top strip is filled with
// --hud-bg (dark grey in dark mode; near-white in light mode) and
// shows the scene's HUD text in --hud-fg via the bold 14px monospace
// rule. Edit mode draws static placeholder ("HUD: score / status")
// so the designer recognises the reserved zone. Play mode reuses
// the existing 'coins: …' formatter.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v27 M3: edit-mode HUD band is rendered with the bg colour', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '########\n#P....E#\n########');
  await page.waitForTimeout(200);
  // Sample a pixel in the middle of the HUD band — y < HUD_HEIGHT (24).
  // Skip a few pixels in from the left edge to avoid the bold-text
  // glyph that paints at x=8.
  const pixel = await page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    return [...ctx.getImageData(150, 12, 1, 1).data];
  });
  // --hud-bg dark mode = #252526 → (37, 37, 38). Allow some slack
  // for sub-pixel / font-antialias colour spill if a sample happens
  // to graze a glyph edge — these are all 30-50.
  expect(pixel[0]).toBeLessThan(70);
  expect(pixel[1]).toBeLessThan(70);
  expect(pixel[2]).toBeLessThan(70);
  // Opaque (not sky).
  expect(pixel[3]).toBeGreaterThan(200);
});

test('v27 M3: edit-mode HUD band contrasts with the level area below', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '########\n#P....E#\n########');
  await page.waitForTimeout(200);
  // Pixel just below the HUD band (y = HUD_HEIGHT + 4 = 28) — that's
  // a row-0 cell, a `#` wall. Should NOT be the HUD bg colour.
  const hudPx = await page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    return [...ctx.getImageData(150, 12, 1, 1).data];
  });
  const levelPx = await page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    return [...ctx.getImageData(150, 28, 1, 1).data];
  });
  // At least one channel should differ by ≥ 10 — confirms a visible
  // boundary at y = HUD_HEIGHT.
  const diff =
    Math.abs(hudPx[0] - levelPx[0]) +
    Math.abs(hudPx[1] - levelPx[1]) +
    Math.abs(hudPx[2] - levelPx[2]);
  expect(diff).toBeGreaterThan(10);
});

test('v27 M3: play-mode HUD band renders the coins text', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '########\n#P.o..E#\n########');
  await page.waitForTimeout(200);
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(150);
  // Sample two patches: one in the HUD band (text expected, fg pixels),
  // one OUTSIDE the band (would be SKY in pre-v27 if text leaked,
  // confirming the text is contained). Bold light-grey text on dark
  // bg → at least some samples in the text region should be much
  // lighter than the bg.
  const samples = await page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    const out = [];
    // Scan a band over the HUD region where the 'coins: …' string is
    // drawn. Engine TILE = 20 → HUD strip = 0..19; text baseline =
    // middle ~y=10. Scan y=6..14, x=8..80.
    for (let x = 8; x <= 80; x += 2) {
      for (let y = 6; y <= 14; y++) {
        const px = ctx.getImageData(x, y, 1, 1).data;
        if (px[0] > 200 && px[1] > 200 && px[2] > 200) {
          out.push([x, y]);
        }
      }
    }
    return out.length;
  });
  // Any letter pixel ≥ 200 across all RGB means we hit the fg text.
  // "coins:" is 6 letters of bold 14px monospace; should yield well
  // over 10 such pixels.
  expect(samples).toBeGreaterThan(10);
});

test('v27 M3: --hud-bg + --hud-fg are defined as CSS vars', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue('--hud-bg').trim(),
      fg: cs.getPropertyValue('--hud-fg').trim(),
    };
  });
  expect(vars.bg).toBeTruthy();
  expect(vars.fg).toBeTruthy();
  // Different — not both falling back to "" or the same value.
  expect(vars.bg).not.toBe(vars.fg);
});
