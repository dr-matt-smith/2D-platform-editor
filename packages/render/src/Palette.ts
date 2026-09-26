import { FallbackShape } from './FallbackShape.ts';
import { FallbackStyle } from './FallbackStyle.ts';

// The renderer's fixed colours: the sky behind every level, the HUD band's
// defaults, and the fallback shape for each Dirt glyph.
//
// The Dirt tileset's tile_lookup.json repeats the glyph colours as legend
// swatches; a test checks the two stay equal.
export class Palette {
  // Painted behind every level, so it shows wherever nothing else is drawn.
  static readonly SKY = '#1b2a3a';
  // HUD band colours when the page defines no --hud-bg / --hud-fg (and in
  // Deno, which has no document).
  static readonly HUD_BACKGROUND = '#252526';
  static readonly HUD_TEXT = '#ececec';

  private static readonly FALLBACKS: ReadonlyMap<string, FallbackStyle> = new Map([
    ['#', new FallbackStyle('#6b4a2f', FallbackShape.Block)],
    ['^', new FallbackStyle('#c0392b', FallbackShape.Spike)],
    ['P', new FallbackStyle('#3498db', FallbackShape.Disc)],
    ['o', new FallbackStyle('#f1c40f', FallbackShape.Pip)],
    ['E', new FallbackStyle('#2ecc71', FallbackShape.Block)],
  ]);

  // Only static members: there is one palette.
  private constructor() {}

  // The fallback style for a glyph, or null for glyphs with none (they are
  // left as background; the validator reports unknown glyphs).
  static fallbackFor(glyph: string): FallbackStyle | null {
    return Palette.FALLBACKS.get(glyph) ?? null;
  }
}
