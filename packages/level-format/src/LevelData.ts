import type { PickupRequired } from './PickupRequirement.ts';
import type { Theme } from './Theme.ts';

// The data of a parsed level, with no behaviour attached. `Level`
// implements it; code that only reads level data (the validator, the
// renderer, the engine) depends on this interface rather than the class,
// so a plain object of the same shape works too.
export interface LevelData {
  readonly meta: LevelMeta;
  // Equal-width rows of glyphs, right-padded with the background glyph.
  readonly grid: readonly string[];
  // The grid rows as written, with their 1-based line in the file.
  readonly rows: readonly LevelRow[];
}

// The header directives of a level, with defaults filled in, plus the
// grid's size.
export interface LevelMeta {
  // `# name:` — null when absent.
  readonly name: string | null;
  // `# theme:` — `Theme.Sky` when absent or unrecognised.
  readonly theme: Theme;
  // `# tileset:` — `Level.DEFAULT_TILESET` when absent.
  readonly tileset: string;
  // Grid size in cells (width is the declared width, if any).
  readonly width: number;
  readonly height: number;
  // `# size: WxH` — null when absent.
  readonly declared: Dimensions | null;
  // `# background-image:` — an image id from the tileset, or null.
  readonly backgroundImage: string | null;
  // `# pickup-required:` — 'all' when absent.
  readonly pickupRequired: PickupRequired;
  // `# viewport: WxH` — null (the default, or `fit`) shows the whole world.
  readonly viewport: Dimensions | null;
}

// A size in grid cells.
export interface Dimensions {
  readonly w: number;
  readonly h: number;
}

// One grid row as written, before padding.
export interface LevelRow {
  readonly text: string;
  // 1-based line number in the original text (comments and directives
  // count), so issues can point at the right line.
  readonly line: number;
}

// A cell of the grid: 0-based column and row.
export interface GridPosition {
  readonly col: number;
  readonly row: number;
}
