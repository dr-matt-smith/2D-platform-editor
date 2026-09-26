import type { GlyphDef, GlyphLookup } from '@2d-platform/level-format';

// The whole of a tileset's `tile_lookup.json`, as `Tileset.load` reads it.
// This is unvalidated JSON, so every field is optional and may be null.
// It extends level-format's `GlyphLookup` (the part the legend reads) with
// the image, animation and terrain fields only the renderer needs.
export interface TileLookup extends GlyphLookup {
  glyphs?: Record<string, TilesetGlyphDef | null | undefined> | null;
  terrain?: TerrainDecl | null;
  // Legacy name for `terrain.masks`, still used by the Dirt tileset.
  filled?: TerrainMasks | null;
  images?: TilesetImages | null;
}

// One `glyphs.<key>` entry, plus the fields that pick its sprite.
export interface TilesetGlyphDef extends GlyphDef {
  // Drawn instead of `image` while the exit is locked.
  imageLocked?: string | null;
  // `image` is a horizontal strip of this many frames.
  frames?: number | null;
  // Always show this frame (no animation).
  frame?: number | null;
  // Animation speed; 0 freezes on frame 0.
  fps?: number | null;
}

// The `terrain` block: autotile images per 4-neighbour mask, and a single
// image for tilesets that ship no edge variants.
export interface TerrainDecl {
  masks?: TerrainMasks | null;
  default?: TerrainMaskDef | null;
}

// Mask ('0'..'15') → image entry.
export type TerrainMasks = Record<string, TerrainMaskDef | null | undefined>;

// One terrain image entry (`terrain.masks[m]`, `terrain.default`, `filled[m]`).
export interface TerrainMaskDef {
  image?: string | null;
}

// Image id → entry. The ids are what `# background-image:` refers to.
export type TilesetImages = Record<string, TilesetImageDef | null | undefined>;

// One `images.<id>` entry. `role` is an `ImageRole` value in valid data.
export interface TilesetImageDef {
  name?: string;
  role?: string;
  image?: string | null;
}
