// v26 M3: when Fit-to-screen is on, clicking on the canvas to
// paint a tile changes the cell the user IS LOOKING AT — the
// overlay's CSS size now matches the preview's, so
// cellFromEvent's scale-ratio inversion reads the correct
// intrinsic-vs-display dims.
//
// Before v26 M3, applyFitToScreen() only scaled #preview; the
// #overlay (which captures pointer events) kept its native
// intrinsic-pixel size as its CSS size, biasing every click by
// the fit scale factor.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v26 M3: overlay CSS size matches preview when Fit is on', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '##########\n#P......E#\n##########');
  await page.waitForTimeout(200);
  // Turn Fit on.
  await page.locator('#fitBtn').click();
  await expect(page.locator('#fitBtn')).toHaveClass(/active/);
  await page.waitForTimeout(80);
  const dims = await page.evaluate(() => {
    const p = document.querySelector('#preview').getBoundingClientRect();
    const o = document.querySelector('#overlay').getBoundingClientRect();
    return { pw: p.width, ph: p.height, ow: o.width, oh: o.height };
  });
  expect(dims.ow).toBeCloseTo(dims.pw, 0); // ≤ 1px tolerance
  expect(dims.oh).toBeCloseTo(dims.ph, 0);
});

test('v26 M3: overlay CSS size clears when Fit is off', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '##########\n#P......E#\n##########');
  await page.waitForTimeout(200);
  // Turn fit on then off — overlay style.width should clear.
  await page.locator('#fitBtn').click();
  await page.waitForTimeout(50);
  await page.locator('#fitBtn').click();
  await page.waitForTimeout(50);
  const overlayInlineW = await page.evaluate(() =>
    document.querySelector('#overlay').style.width,
  );
  expect(overlayInlineW).toBe('');
});

test('v26 M3: click in Fit mode targets the visible cell', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Wider level so the cell coordinates are easier to reason about.
  await injectLevel(page, [
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#......P......E#',
    '################',
  ].join('\n'));
  await page.waitForTimeout(200);
  // Make Fit ON so the click-to-paint test exercises the bug-prone
  // path.
  await page.locator('#fitBtn').click();
  await expect(page.locator('#fitBtn')).toHaveClass(/active/);
  await page.waitForTimeout(80);
  // Active glyph is whatever is selected — use `.` (background)
  // to "erase" or pick the wall glyph. We pick a wall ('#'); but
  // we need to set activeGlyph by clicking the legend item first.
  await page.locator('.legend .glyph[data-glyph="#"]').click();
  // Sample a screen position over a specific cell. The overlay
  // covers the visible canvas; pick a position clearly inside one
  // cell. With Fit on, the overlay's getBoundingClientRect gives
  // the CSS-scaled rect; we compute the centre of cell (3, 8).
  const target = await page.evaluate(() => {
    const r = document.querySelector('#overlay').getBoundingClientRect();
    const W = 16; // grid width
    const H = 8;
    // v27 M2: overlay is HUD_HEIGHT_TILES (= 1) cells taller than the
    // grid. So in CSS units, total effective rows = H + 1; the HUD
    // strip occupies the first row.
    const cellW = r.width / W;
    const cellH = r.height / (H + 1);
    return {
      x: r.left + cellW * 8 + cellW / 2,
      // Skip the HUD strip + 3 level rows; centre of cell row 3.
      y: r.top + cellH * (1 + 3) + cellH / 2,
      row: 3,
      col: 8,
    };
  });
  // Single click at that position.
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(100);
  // Inspect the buffer — row 3 col 8 should now be '#' (was '.').
  const cellChar = await page.evaluate(({ row, col }) => {
    const text = document.querySelector('#src').value;
    // Skip the header lines until the first non-`#`-prefixed line.
    const lines = text.split('\n');
    const gridLines = lines.filter((l) => !l.startsWith('#'));
    // Wait — '#' is also a wall glyph that starts grid lines. The
    // text parser treats lines starting with `# ` (with space) as
    // directives; level grids start with `#` walls. Identify grid
    // lines by length matching the level width (16).
    const grids = lines.filter((l) => l.length === 16);
    return grids[row]?.[col] ?? null;
  }, target);
  expect(cellChar).toBe('#');
});
