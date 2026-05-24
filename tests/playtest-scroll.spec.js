// v19 regression spec: a level with `# viewport: WxH` mounts a viewport-
// sized playtest canvas, and walking the player horizontally scrolls
// the camera through the world. Paired with the v18 size-probe spec
// (which asserts the rect-pin for fit mode), this guards both halves
// of the play-in-place geometry contract.

import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

// Inject a deterministic test level into the editor buffer: a 40-cell-
// wide × 10-cell-tall world with a long open corridor, `P` near the
// left, `E` at the right end, and a `# viewport: 16x10` directive so
// only ~16 cells are visible at once.
const WORLD_W_CELLS = 40;
const WORLD_H_CELLS = 10;
const VIEWPORT_W_CELLS = 16;
const VIEWPORT_H_CELLS = 10;
const ENGINE_TILE = 20; // src/play/constants.js — vendored

function injectScrollableLevel(page) {
  return page.evaluate(({ ww, vw, vh }) => {
    const top = '#'.repeat(ww);
    const mid = '#P' + '.'.repeat(ww - 4) + 'E#';
    const empty = '#' + '.'.repeat(ww - 2) + '#';
    const text = [
      `# viewport: ${vw}x${vh}`,
      top, empty, empty, mid, empty, empty, empty, empty, empty, top,
    ].join('\n');
    document.querySelector('#src').value = text;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, { ww: WORLD_W_CELLS, vw: VIEWPORT_W_CELLS, vh: VIEWPORT_H_CELLS });
}

async function hashCanvas(page) {
  const dataUrl = await page.evaluate(() => document.querySelector('#preview').toDataURL('image/png'));
  return crypto.createHash('sha1').update(dataUrl).digest('hex');
}

test('windowed viewport: canvas sized to viewport AND camera scrolls on walk', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await page.waitForFunction(() => {
    const c = document.querySelector('#preview');
    return c && c.width > 0;
  });

  await injectScrollableLevel(page);
  // Wait out the input-debounce that drives reflow().
  await page.waitForTimeout(400);

  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));

  // The canvas intrinsic resolution should be the viewport (16*20 ×
  // 10*20 = 320 × 200), NOT the world (40*20 × 10*20). This proves
  // the launcher honoured `# viewport:` instead of falling back to
  // world dims.
  const intrinsic = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    return { w: c.width, h: c.height };
  });
  // v27 M2: canvas height = viewport rows × TILE + HUD strip (1 × TILE).
  expect(intrinsic).toEqual({
    w: VIEWPORT_W_CELLS * ENGINE_TILE,
    h: VIEWPORT_H_CELLS * ENGINE_TILE + ENGINE_TILE,
  });

  // Hash before walking. Give the playtest a few rAF frames so the
  // camera-init and first paint settle.
  await page.waitForTimeout(120);
  const hashBefore = await hashCanvas(page);

  // Walk right for ~800ms — well past the dead-zone width so the
  // camera definitely tracks the player into the previously-off-
  // screen world cells.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(120);

  const hashAfter = await hashCanvas(page);

  // The visible content must have changed (the camera scrolled into
  // a different slice of the world).
  expect(hashAfter).not.toBe(hashBefore);

  // The canvas intrinsic must NOT have changed mid-scroll — the
  // viewport defines the canvas size for the whole play session.
  const intrinsicAfter = await page.evaluate(() => {
    const c = document.querySelector('#preview');
    return { w: c.width, h: c.height };
  });
  expect(intrinsicAfter).toEqual(intrinsic);
});
