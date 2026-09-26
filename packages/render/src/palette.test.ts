import { assertEquals } from '@std/assert';
import { SKY, FALLBACK } from './palette.ts';

// Drift guard (design §11 #2): the renderer's flat colours live in palette.js
// but are duplicated into each tileset's tile_lookup.json `glyphs` so the
// thumbnail legend carries swatches. This proves the Dirt set's duplicated
// colours stay byte-equal to the single source until v9 "2c" unifies them.
Deno.test('Dirt tile_lookup glyph colours match the palette single source', () => {
  const { glyphs } = JSON.parse(
    Deno.readTextFileSync('content/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json'),
  );
  assertEquals(glyphs.empty.color, SKY);
  assertEquals(glyphs.player.color, FALLBACK.P.color);
  assertEquals(glyphs.exit.color, FALLBACK.E.color);
  assertEquals(glyphs.hazard.color, FALLBACK['^'].color);
  assertEquals(glyphs.pickup.color, FALLBACK.o.color);
  // `filled` is image-backed (the legible dirt-top thumbnail), not a swatch.
  assertEquals(glyphs.filled.color, null);
  assertEquals(glyphs.filled.image, 'tiles/01_dirt_top.png');
});
