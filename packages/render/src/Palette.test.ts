import { assertEquals } from '@std/assert';
import { FallbackShape } from './FallbackShape.ts';
import { Palette } from './Palette.ts';

// Drift guard: the renderer's flat colours live in `Palette`, but are
// repeated in each tileset's tile_lookup.json `glyphs` so the legend can
// show swatches. This proves the Dirt set's copies stay equal.
Deno.test('Dirt tile_lookup glyph colours match the palette single source', () => {
  const { glyphs } = JSON.parse(
    Deno.readTextFileSync('content/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json'),
  );
  assertEquals(glyphs.empty.color, Palette.SKY);
  assertEquals(glyphs.player.color, Palette.fallbackFor('P')!.color);
  assertEquals(glyphs.exit.color, Palette.fallbackFor('E')!.color);
  assertEquals(glyphs.hazard.color, Palette.fallbackFor('^')!.color);
  assertEquals(glyphs.pickup.color, Palette.fallbackFor('o')!.color);
  // `filled` is image-backed (the legible dirt-top thumbnail), not a swatch.
  assertEquals(glyphs.filled.color, null);
  assertEquals(glyphs.filled.image, 'tiles/01_dirt_top.png');
});

Deno.test('Palette.fallbackFor: a shape per Dirt glyph, null for others', () => {
  assertEquals(Palette.fallbackFor('#')!.shape, FallbackShape.Block);
  assertEquals(Palette.fallbackFor('^')!.shape, FallbackShape.Spike);
  assertEquals(Palette.fallbackFor('P')!.shape, FallbackShape.Disc);
  assertEquals(Palette.fallbackFor('o')!.shape, FallbackShape.Pip);
  assertEquals(Palette.fallbackFor('E')!.shape, FallbackShape.Block);
  assertEquals(Palette.fallbackFor('Z'), null);
  assertEquals(Palette.fallbackFor('.'), null);
});
