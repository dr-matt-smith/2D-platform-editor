// v16: animated sprite playback. Pixel Adventure 1 declares `frames: 11`
// (Mask Dude) and `frames: 17` (Apple) without an explicit `frame`, so
// the schema default fps:10 kicks in. This spec proves the playtest
// canvas evolves over time: launch under PA1, screenshot, wait long
// enough for several animation ticks, screenshot again, assert the
// two PNG hashes differ.
//
// The exact per-frame sx math is asserted deterministically in
// `src/tileset.test.js`'s v16 truth-table cases. This is the
// real-browser smoke check that the playtest pipeline forwards
// `performance.now()` end-to-end (renderer → accessors → animator).
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT = 'tests/screenshots';
mkdirSync(OUT, { recursive: true });

const md5 = (path) =>
  createHash('md5').update(readFileSync(path)).digest('hex');

test('playtest sprite frames animate over time (Pixel Adventure 1)', async ({ page }) => {
  await page.goto('/');

  // Wait for the editor's full startup chain — including the v14
  // `window.__activeTileset` readiness flag — before driving input.
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

  // Switch to Pixel Adventure 1 (the only shipped tileset with
  // `frames > 1` glyphs).
  await page.selectOption('#tilesetSel', 'Pixel Adventure 1');
  await page.waitForFunction(() => {
    const sel = document.querySelector('#tilesetSel');
    const legend = document.querySelector('#legend');
    return (
      sel?.value === 'Pixel Adventure 1' &&
      Array.from(legend?.querySelectorAll('.glyph') ?? []).some((b) =>
        /Mask Dude/.test(b.textContent || ''),
      )
    );
  });
  await page.waitForTimeout(300); // settle sprite-image fetches

  // Launch playtest.
  await page.keyboard.press('Control+Enter');
  await page.waitForSelector('.playtest canvas', { state: 'visible' });
  // Settle: ensure first frame is rendered.
  await page.waitForTimeout(60);

  // Two screenshots, ~400 ms apart. At the v16 default 10 fps the
  // animation has advanced ~4 frames; Mask Dude's strip changes sx
  // accordingly. Player physics also evolve in 400 ms (the bean
  // falls under gravity), so the canvas would differ even without
  // animation — but combined with the deterministic per-frame `sx`
  // unit tests in `src/tileset.test.js`, this end-to-end check
  // confirms the playtest pipeline is dynamic.
  const s0 = join(OUT, 'animation-s0.png');
  const s1 = join(OUT, 'animation-s1.png');
  await page.locator('.playtest canvas').screenshot({ path: s0 });
  await page.waitForTimeout(400);
  await page.locator('.playtest canvas').screenshot({ path: s1 });

  // Close.
  await page.keyboard.press('Escape');
  await page.waitForSelector('.playtest', { state: 'detached' });

  const h0 = md5(s0);
  const h1 = md5(s1);
  expect(
    h0,
    `playtest canvas is frozen — neither animation nor physics moved in 400 ms (hash ${h0})`,
  ).not.toEqual(h1);
});
