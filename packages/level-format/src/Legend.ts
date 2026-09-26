import { isKnownRole, Role } from './Role.ts';
import type { GlyphDef, GlyphLookup } from './GlyphLookup.ts';
import type { LegendEntry, LegendRecord } from './LegendEntry.ts';

// The glyph legend of a tileset: which characters may appear in a level
// grid, and what each one is (`LegendEntry`). Immutable once built.
//
// Build one from a tileset's tile_lookup.json with `Legend.fromLookup`,
// or use `Legend.DEFAULT` (the Dirt set) when there is no tileset.
export class Legend implements Iterable<[string, LegendEntry]> {
  // Legacy lookups use coarse role names ('entity' / 'terrain') and rely on
  // the glyph's KEY for its meaning (`glyphs.player`, `glyphs.hazard`, …).
  // For these keys the key wins over the declared role, so old tilesets
  // keep working with no data migration.
  private static readonly ROLE_FROM_KEY: Readonly<Record<string, Role>> = Object.freeze({
    empty: Role.Background,
    filled: Role.Terrain,
    player: Role.Player,
    exit: Role.Exit,
    hazard: Role.Hazard,
    pickup: Role.Pickup,
  });

  // The Dirt glyph set: the offline fallback and the validator's default.
  static readonly DEFAULT: Legend = new Legend({
    '.': { name: 'Empty', role: Role.Background, image: null, color: '#1b2a3a' },
    '#': { name: 'Filled', role: Role.Terrain, image: 'tiles/01_dirt_top.png', color: null },
    P: { name: 'Player spawn', role: Role.Player, image: null, color: '#3498db' },
    '^': { name: 'Hazard', role: Role.Hazard, image: null, color: '#c0392b' },
    o: { name: 'Pickup', role: Role.Pickup, image: null, color: '#f1c40f' },
    E: { name: 'Exit', role: Role.Exit, image: null, color: '#2ecc71' },
  });

  // A plain object rather than a Map: iteration then follows the same
  // (Object.entries) order the editor's legend panel has always used.
  private readonly byGlyph: Readonly<Record<string, LegendEntry>>;

  private constructor(byGlyph: Record<string, LegendEntry>) {
    this.byGlyph = Object.freeze(byGlyph);
  }

  // Build the legend from a tileset's tile_lookup.json. Glyphs without a
  // `char` are skipped; a lookup with no `glyphs` gives `Legend.DEFAULT`.
  static fromLookup(lookup: GlyphLookup | null | undefined): Legend {
    const glyphs = lookup?.glyphs;
    if (!glyphs) return Legend.DEFAULT;
    const byGlyph: Record<string, LegendEntry> = {};
    for (const [key, g] of Object.entries(glyphs)) {
      if (!g?.char) continue;
      byGlyph[g.char] = {
        name: g.name ?? g.char,
        role: Legend.resolveRole(key, g),
        image: g.image ?? null,
        color: g.color ?? null,
      };
    }
    return new Legend(byGlyph);
  }

  // Rebuild a legend from its plain-object form (see `toRecord`). Missing
  // names default to the glyph itself; `null` gives an empty legend.
  static fromRecord(record: LegendRecord | null | undefined): Legend {
    const byGlyph: Record<string, LegendEntry> = {};
    for (const [glyph, e] of Object.entries(record ?? {})) {
      if (!e) continue;
      byGlyph[glyph] = {
        name: e.name ?? glyph,
        role: e.role,
        image: e.image ?? null,
        color: e.color ?? null,
      };
    }
    return new Legend(byGlyph);
  }

  // A legacy key decides the role; otherwise the declared `role` does,
  // and an unrecognised one becomes `Role.Unknown`.
  private static resolveRole(key: string, glyph: GlyphDef): Role {
    if (Object.hasOwn(Legend.ROLE_FROM_KEY, key)) return Legend.ROLE_FROM_KEY[key];
    return isKnownRole(glyph.role) ? glyph.role : Role.Unknown;
  }

  // Number of glyphs in the legend.
  get size(): number {
    return Object.keys(this.byGlyph).length;
  }

  has(glyph: string): boolean {
    return Object.hasOwn(this.byGlyph, glyph);
  }

  get(glyph: string): LegendEntry | undefined {
    return this.has(glyph) ? this.byGlyph[glyph] : undefined;
  }

  // The glyph's role, or null when the glyph is not in the legend (the
  // validator reports such glyphs as undefined).
  roleOf(glyph: string): Role | null {
    return this.get(glyph)?.role ?? null;
  }

  // Every glyph whose entry has `role`, in legend order.
  glyphsWithRole(role: Role): string[] {
    return this.glyphs().filter((g) => this.byGlyph[g].role === role);
  }

  glyphs(): string[] {
    return Object.keys(this.byGlyph);
  }

  entries(): [string, LegendEntry][] {
    return Object.entries(this.byGlyph);
  }

  [Symbol.iterator](): Iterator<[string, LegendEntry]> {
    return this.entries()[Symbol.iterator]();
  }

  // The legend as a frozen plain object, for code that takes a
  // glyph-keyed record rather than this class (the agent package).
  toRecord(): Readonly<Record<string, LegendEntry>> {
    return this.byGlyph;
  }
}
