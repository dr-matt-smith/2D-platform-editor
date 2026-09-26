import type { Role } from './Role.ts';

// One glyph's entry in a `Legend`: what it is called, what it does, and
// how the editor shows it when there is no tileset art.
export interface LegendEntry {
  readonly name: string;
  readonly role: Role;
  // Tileset-relative image path, or null for a plain colour swatch.
  readonly image: string | null;
  // Swatch colour (CSS), or null when the glyph has an image.
  readonly color: string | null;
}

// A plain glyph -> entry object: the form a legend takes when it crosses
// to code that must not depend on this package (the agent reads
// `legend[glyph]?.role` directly). Only `role` is required, so a
// role-only map (as in tests) is a valid record too.
export type LegendRecord = Readonly<
  Record<string, Pick<LegendEntry, 'role'> & Partial<LegendEntry>>
>;
