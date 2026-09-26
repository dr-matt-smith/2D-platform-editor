// The part of a tileset's `tile_lookup.json` that `Legend.fromLookup`
// reads. This is unvalidated JSON, so every field is optional.
export interface GlyphLookup {
  // Keyed by a descriptive name (`player`, `filled`, `apple`, …).
  glyphs?: Record<string, GlyphDef | null | undefined> | null;
}

// One raw entry of `glyphs`. `role` may be a legacy name (e.g. 'entity')
// or missing; `Legend.fromLookup` resolves it to a `Role`.
export interface GlyphDef {
  char?: string;
  name?: string;
  role?: string;
  image?: string | null;
  color?: string | null;
}
