import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKY, FALLBACK } from './palette.js';

// Drift guard (design §11 #2): the renderer's flat colours live in palette.js
// but are duplicated into each tileset's tile_lookup.json `glyphs` so the
// thumbnail legend carries swatches. This proves the Dirt set's duplicated
// colours stay byte-equal to the single source until v9 "2c" unifies them.
test('Dirt tile_lookup glyph colours match the palette single source', () => {
  const { glyphs } = JSON.parse(
    readFileSync(
      'public/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json',
      'utf8',
    ),
  );
  assert.equal(glyphs.empty.color, SKY);
  assert.equal(glyphs.player.color, FALLBACK.P.color);
  assert.equal(glyphs.exit.color, FALLBACK.E.color);
  assert.equal(glyphs.hazard.color, FALLBACK['^'].color);
  assert.equal(glyphs.pickup.color, FALLBACK.o.color);
  // `filled` is image-backed (the legible dirt-top thumbnail), not a swatch.
  assert.equal(glyphs.filled.color, null);
  assert.equal(glyphs.filled.image, 'tiles/01_dirt_top.png');
});
