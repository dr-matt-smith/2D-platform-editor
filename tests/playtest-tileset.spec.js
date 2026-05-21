// v14: the playtest canvas now uses the active tileset's art. This
// spec drives the editor in a real browser, launches playtest under
// two different tilesets (Dirt → default, PlayWithYourPeas → switch
// via the toolbar dropdown), screenshots each playtest canvas, and
// asserts the two hashes differ — proving the playtest follows the
// tileset choice, not the kaplay sprites.
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT = 'tests/screenshots';
mkdirSync(OUT, { recursive: true });

const md5 = (path) =>
  createHash('md5').update(readFileSync(path)).digest('hex');

// Wait for the editor's whole startup chain — and crucially, for the
// active tileset to have finished loading (window.__activeTileset is
// set by main.js's syncTileset). The legend-has-glyphs check alone
// races the async tileset fetch and can fire Ctrl+Enter while the
// tileset is still null, which paints the playtest with fallback
// shapes rather than the tileset's art.
async function waitForEditorReady(page) {
  await page.waitForFunction(() => {
    const src = document.querySelector('#src');
    const sel = document.querySelector('#tilesetSel');
    const legend = document.querySelector('#legend');
    return (
      (src?.value.length ?? 0) > 0 &&
      (sel?.options.length ?? 0) >= 1 &&
      !!legend?.querySelector('.glyph') &&
      !!window.__activeTileset
    );
  });
}

async function launchAndScreenshot(page, slug) {
  // Control+Enter triggers the editor's tryPlaytest hotkey (the
  // launcher honours both Ctrl and Meta; we pick Ctrl so it works
  // on the Linux CI runner without modifier-translation gymnastics).
  await page.keyboard.press('Control+Enter');

  // Wait for the overlay canvas to mount.
  // v18: play-in-place — no modal. PlaytestScene mounts on the
  // editor's #preview; body.playmode signals we're in play mode.
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  // Settle: tileset sprites already loaded by the editor on the
  // previous reflow, so a short tick is enough for the first frame.
  await page.waitForTimeout(300);

  const path = join(OUT, `playtest-${slug}.png`);
  await page.locator('#preview').screenshot({ path });

  // Esc closes the overlay (launcher owns the capture-phase Escape).
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('playmode'));

  return path;
}

test('playtest follows the active tileset (Dirt ≠ PlayWithYourPeas)', async ({ page }) => {
  await page.goto('/');
  await waitForEditorReady(page);

  // First playtest: the default (Dirt) tutorial.
  const dirtPath = await launchAndScreenshot(page, 'Dirt');

  // Switch to PlayWithYourPeas via the toolbar dropdown; wait for the
  // reflow (legend rebuilt against the new lookup).
  await page.selectOption('#tilesetSel', 'PlayWithYourPeas');
  await page.waitForFunction(() => {
    const sel = document.querySelector('#tilesetSel');
    const legend = document.querySelector('#legend');
    return (
      sel?.value === 'PlayWithYourPeas' &&
      legend?.querySelector('.glyph') &&
      // The PWYP legend includes a "Pea" entry — wait for that
      // specifically so we know the new lookup is the one rendering.
      Array.from(legend.querySelectorAll('.glyph')).some((b) =>
        /Pea/.test(b.textContent || ''),
      )
    );
  });
  // Give the image fetches a moment to settle past the manifest+JSON.
  await page.waitForTimeout(500);

  const peasPath = await launchAndScreenshot(page, 'PlayWithYourPeas');

  const dirtHash = md5(dirtPath);
  const peasHash = md5(peasPath);
  expect(
    dirtHash,
    `playtest looks identical across tilesets — the static layer didn't follow the tileset switch (Dirt vs PlayWithYourPeas hashed the same: ${dirtHash})`,
  ).not.toEqual(peasHash);
});
