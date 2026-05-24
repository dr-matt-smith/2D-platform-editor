// v27 M2: HUD-band canvas geometry. The renderer now sizes the
// canvas to rows*TILE + HUD_HEIGHT (one extra tile-row) and
// translates level drawing down by HUD_HEIGHT. cellFromEvent
// subtracts HUD_HEIGHT before grid-row conversion; drawMarquee /
// drawViewportGuide / the agent path overlay all paint at
// y + HUD_HEIGHT. This spec covers the click-to-cell math + the
// rendered-canvas dimensions.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v27 M2: preview canvas intrinsic height = rows*TILE + HUD_HEIGHT', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // 24x10 tutorial. Editor TILE = 24 → level height = 240 px;
  // HUD strip adds 24 px → canvas.height = 264.
  await injectLevel(page, await page.evaluate(async () => {
    const r = await fetch('data/levels/tutorial.txt');
    return r.ok ? await r.text() : null;
  }));
  await page.waitForTimeout(200);
  const dims = await page.locator('#preview').evaluate((c) => ({ w: c.width, h: c.height }));
  expect(dims.w).toBe(24 * 24);
  expect(dims.h).toBe(10 * 24 + 24);
});

test('v27 M2: overlay intrinsic height matches preview (HUD band included)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, await page.evaluate(async () => {
    const r = await fetch('data/levels/tutorial.txt');
    return r.ok ? await r.text() : null;
  }));
  await page.waitForTimeout(200);
  const sizes = await page.evaluate(() => {
    const p = document.querySelector('#preview');
    const o = document.querySelector('#overlay');
    return { pw: p.width, ph: p.height, ow: o.width, oh: o.height };
  });
  expect(sizes.ow).toBe(sizes.pw);
  expect(sizes.oh).toBe(sizes.ph);
});

test('v27 M2: click at HUD-band y is no-op (no cell painted)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Small flat level so we can target known cells. Fit OFF for
  // intrinsic-pixel click math.
  await injectLevel(page, '########\n#P....E#\n########');
  await page.waitForTimeout(200);
  const fitActive = await page.locator('#fitBtn').evaluate((b) => b.classList.contains('active'));
  if (fitActive) await page.locator('#fitBtn').click();
  await page.waitForTimeout(80);
  // Use the wall glyph so a paint, if it occurred, would be visible
  // as a change in the level text. Wall is the default-ish glyph;
  // click an empty cell with it to detect any painting.
  await page.evaluate(() => {
    document.querySelector(`[data-glyph="#"]`)?.click();
  });
  const before = await page.locator('#src').inputValue();
  // Click at y=8 (well inside the HUD band — < HUD_HEIGHT = 24 px),
  // x=80 (any horizontal). This must be a no-op.
  const rect = await page.locator('#overlay').evaluate((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  await page.mouse.click(rect.x + 80, rect.y + 8);
  await page.waitForTimeout(80);
  const after = await page.locator('#src').inputValue();
  // Buffer unchanged — click landed in HUD band; main.js click handler
  // ignores clicks where cellFromEvent reports inHud=true.
  expect(after).toBe(before);
});

test('v27 M2: click below HUD band paints the expected cell', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '########\n#P....E#\n########');
  await page.waitForTimeout(200);
  const fitActive = await page.locator('#fitBtn').evaluate((b) => b.classList.contains('active'));
  if (fitActive) await page.locator('#fitBtn').click();
  await page.waitForTimeout(80);
  // Select the wall glyph.
  await page.evaluate(() => {
    document.querySelector(`[data-glyph="#"]`)?.click();
  });
  const rect = await page.locator('#overlay').evaluate((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  // Click at (col 3, row 1) → x = 3*24 + 12 = 84; y = HUD_HEIGHT + 1*24 + 12 = 60.
  // The cell '.' at row 1, col 3 should flip to '#'.
  await page.mouse.click(rect.x + 3 * 24 + 12, rect.y + 24 + 1 * 24 + 12);
  await page.waitForTimeout(120);
  const after = await page.locator('#src').inputValue();
  // The buffer's row-1 starts with '#P..' originally; col 3 paint
  // changes '.' → '#'. Look for the new pattern.
  expect(after).toContain('#P.#..E#');
});
