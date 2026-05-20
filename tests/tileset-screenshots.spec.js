// Diagnostic: for every tileset in the manifest, switch the editor to it
// via the toolbar <select>, wait for the reflow, and screenshot both the
// preview canvas and the legend. The aim is to make the v8 decor-atlas
// limit visible — only Dirt has a platformertiles.png so the renderer's
// `ready` flag goes false for everything else and the canvas drops to flat
// shape colours that look identical across non-Dirt tilesets. The legend
// thumbnails are independent (driven by glyphs[*].image) and should look
// distinct in every set.
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const OUT = 'tests/screenshots';
mkdirSync(OUT, { recursive: true });

const slug = (s) => s.replace(/\s+/g, '-');

test('capture preview + legend for every manifest tileset', async ({ page }) => {
  const manifest = JSON.parse(
    readFileSync('public/data/tilesets/manifest.json', 'utf8'),
  );
  test.info().annotations.push({ type: 'manifest', description: manifest.map((t) => t.id).join(', ') });

  await page.goto('/');
  // Wait for the WHOLE startup chain, not just the menu: levels.init()
  // populates the menu, but the buffer + legend only fill in after the
  // subsequent setBuffer/reflow. Screenshotting before that lands gives a
  // blank canvas for whichever tileset is iterated first.
  await page.waitForFunction(() => {
    const src = document.querySelector('#src');
    const sel = document.querySelector('#tilesetSel');
    const legend = document.querySelector('#legend');
    return (
      (src?.value.length ?? 0) > 0 &&
      (sel?.options.length ?? 0) >= 1 &&
      !!legend?.querySelector('.glyph')
    );
  });

  // A consistent base level for every screenshot (the default tutorial),
  // so the only thing changing between shots is the tileset selection.
  for (const ts of manifest) {
    await page.selectOption('#tilesetSel', ts.id);

    // Wait for the reflow: tileset fetch (cached after first hit) + the
    // legend re-render + the canvas redraw. Lookups can fail (no atlas)
    // and that's expected — we want to see the result, not assert it.
    await page.waitForFunction(
      (id) => {
        const sel = document.querySelector('#tilesetSel');
        const legend = document.querySelector('#legend');
        // Sample a few legend chars to confirm the menu's choice landed.
        return sel?.value === id && legend?.querySelector('.glyph');
      },
      ts.id,
      { timeout: 5000 },
    );
    // Belt-and-braces: small settle for any in-flight tileset image loads.
    await page.waitForTimeout(400);

    await page
      .locator('#preview')
      .screenshot({ path: join(OUT, `${slug(ts.id)}-preview.png`) });
    await page
      .locator('#legend')
      .screenshot({ path: join(OUT, `${slug(ts.id)}-legend.png`) });
    // A combined shot of the editor's right pane for context.
    await page
      .locator('.pane.right')
      .screenshot({ path: join(OUT, `${slug(ts.id)}-pane.png`) });
  }

  // Sanity assertion: every tileset produced a preview file.
  expect(manifest.length).toBeGreaterThan(0);
});

// v10 acceptance gate. Before v10 this would fail (Pixel Adventure / Peas /
// Treasure Hunters all hashed 2ba7f2c8 — the v8 shape fallback ignored the
// active tileset). After v10 (renderer reads tileset.terrainFor / entityFor
// per cell) every tileset's preview is its own — so the hashes must be
// pairwise distinct. Same `tutorial` level for every shot, so any pair
// matching means the renderer isn't tileset-aware on the canvas.
test('preview canvases hash mutually distinctly across tilesets', () => {
  const files = readdirSync(OUT)
    .filter((f) => f.endsWith('-preview.png'))
    .sort();
  expect(files.length, 'no preview screenshots — run the capture test first').toBeGreaterThan(1);

  const hashByFile = new Map(
    files.map((f) => [
      f,
      createHash('md5').update(readFileSync(join(OUT, f))).digest('hex'),
    ]),
  );
  // Pairwise compare and report ALL collisions, not just the first one.
  const collisions = [];
  const entries = [...hashByFile.entries()];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i][1] === entries[j][1]) {
        collisions.push(`${entries[i][0]} == ${entries[j][0]} (${entries[i][1]})`);
      }
    }
  }
  expect(
    collisions,
    `tilesets render identically on the canvas (legend may still look right):\n  ${collisions.join('\n  ')}`,
  ).toEqual([]);
});
