// A parsed level. The text format is a few optional `# key: value` header
// directives, then an ASCII grid; `//` lines are comments, dropped when
// parsing:
//
//   # name: tutorial-01
//   # size: 20x6
//   ####################
//   #...P.........E....#
//
import { Legend } from './Legend.ts';
import { LevelValidator } from './LevelValidator.ts';
import { PickupRequirement } from './PickupRequirement.ts';
import { Theme } from './Theme.ts';
import type { Role } from './Role.ts';
import type { ValidationIssue } from './ValidationIssue.ts';
import type { Dimensions, GridPosition, LevelData, LevelMeta, LevelRow } from './LevelData.ts';

// `LevelMeta` while it is being filled in by `parse`.
type MutableMeta = { -readonly [K in keyof LevelMeta]: LevelMeta[K] };

export class Level implements LevelData {
  // The glyph that pads short rows: empty space.
  static readonly BACKGROUND_GLYPH = '.';
  // The tileset used when a level has no `# tileset:` directive.
  static readonly DEFAULT_TILESET = 'Dirt_Platformer_Tiles';
  // `# viewport:` sizes are clamped to this range (the same range the
  // New-level dialog allows), rather than rejected.
  static readonly VIEWPORT_MIN = 4;
  static readonly VIEWPORT_MAX = 200;

  // `-` is allowed in keys (`background-image`, `pickup-required`).
  private static readonly DIRECTIVE = /^#\s*([\w-]+)\s*:\s*(.+?)\s*$/;
  private static readonly SIZE = /^(\d+)\s*x\s*(\d+)$/i;

  private constructor(
    readonly meta: LevelMeta,
    readonly grid: readonly string[],
    readonly rows: readonly LevelRow[],
  ) {}

  // Parse level text. Unknown directives are ignored and malformed values
  // fall back to their defaults, so any text gives a level (problems are
  // reported by `validate`, not thrown).
  static parse(text: string): Level {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const meta = Level.defaultMeta();
    const rows: LevelRow[] = [];
    let inGrid = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (Level.isComment(line)) continue;
      if (!inGrid) {
        // A wall row ("####") never matches the key:value shape, so
        // directives stay unambiguous inside the header region.
        const m = line.match(Level.DIRECTIVE);
        if (m) {
          Level.applyDirective(meta, m[1].toLowerCase(), m[2]);
          continue;
        }
        inGrid = true; // the first other line starts the grid
      }
      rows.push({ text: line, line: i + 1 });
    }
    return Level.fromRows(meta, rows);
  }

  // Build a level from grid rows and any header values (the rest take
  // their defaults). Width and height are always derived from the grid.
  static create(grid: readonly string[], meta: Partial<LevelMeta> = {}): Level {
    const rows = grid.map((text, i) => ({ text, line: i + 1 }));
    return Level.fromRows({ ...Level.defaultMeta(), ...meta }, rows);
  }

  // Clamp a viewport size to [VIEWPORT_MIN, VIEWPORT_MAX]; anything that
  // is not a number becomes VIEWPORT_MIN.
  static clampViewport(n: number): number {
    return Math.max(
      Level.VIEWPORT_MIN,
      Math.min(Level.VIEWPORT_MAX, Math.round(Number(n) || 0) || Level.VIEWPORT_MIN),
    );
  }

  // True for a `//` comment line (leading spaces allowed).
  static isComment(line: string): boolean {
    return line.trimStart().startsWith('//');
  }

  private static defaultMeta(): MutableMeta {
    return {
      name: null,
      theme: Theme.Sky,
      tileset: Level.DEFAULT_TILESET,
      width: 0,
      height: 0,
      declared: null,
      backgroundImage: null,
      pickupRequired: 'all',
      viewport: null,
    };
  }

  // Pad the rows to the level's width and fill in width and height.
  private static fromRows(meta: MutableMeta, rows: LevelRow[]): Level {
    const width = meta.declared
      ? meta.declared.w
      : rows.reduce((max, r) => Math.max(max, r.text.length), 0);
    const grid = rows.map((r) =>
      r.text.length >= width ? r.text : r.text + Level.BACKGROUND_GLYPH.repeat(width - r.text.length)
    );
    meta.width = width;
    meta.height = rows.length;
    return new Level(meta, grid, rows);
  }

  private static applyDirective(meta: MutableMeta, key: string, value: string): void {
    switch (key) {
      case 'name':
        meta.name = value;
        break;
      case 'tileset':
        meta.tileset = value;
        break;
      case 'theme': {
        const theme = value.toLowerCase();
        meta.theme = Object.values<string>(Theme).includes(theme) ? (theme as Theme) : Theme.Sky;
        break;
      }
      case 'size': {
        const s = value.match(Level.SIZE);
        if (s) meta.declared = { w: Number(s[1]), h: Number(s[2]) };
        break;
      }
      case 'background-image':
      case 'backgroundimage':
        // An id from the tileset's images; an unknown id just draws no image.
        meta.backgroundImage = value || null;
        break;
      case 'pickup-required':
      case 'pickuprequired':
        // Malformed values keep the default ('all').
        meta.pickupRequired = PickupRequirement.parseValue(value) ?? meta.pickupRequired;
        break;
      case 'viewport':
        meta.viewport = Level.parseViewport(value, meta.viewport);
        break;
    }
  }

  // 'fit' → null (whole world); 'WxH' → clamped size; anything else
  // leaves `current` unchanged.
  private static parseViewport(value: string, current: Dimensions | null): Dimensions | null {
    if (value.trim().toLowerCase() === 'fit') return null;
    const m = value.match(Level.SIZE);
    if (!m) return current;
    return { w: Level.clampViewport(Number(m[1])), h: Level.clampViewport(Number(m[2])) };
  }

  get name(): string | null {
    return this.meta.name;
  }

  get tileset(): string {
    return this.meta.tileset;
  }

  get theme(): Theme {
    return this.meta.theme;
  }

  get width(): number {
    return this.meta.width;
  }

  get height(): number {
    return this.meta.height;
  }

  get pickupRequirement(): PickupRequirement {
    return new PickupRequirement(this.meta.pickupRequired);
  }

  // The glyph at a 0-based column and row, or undefined off the grid.
  cellAt(col: number, row: number): string | undefined {
    return this.grid[row]?.[col];
  }

  // Every cell whose glyph has `role` in `legend`, in reading order.
  findCells(role: Role, legend: Legend = Legend.DEFAULT): GridPosition[] {
    const cells: GridPosition[] = [];
    this.grid.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        if (legend.roleOf(line[col]) === role) cells.push({ col, row });
      }
    });
    return cells;
  }

  // Problems with the level, judged against the tileset's legend.
  validate(legend: Legend = Legend.DEFAULT): ValidationIssue[] {
    return new LevelValidator(legend).validate(this);
  }

  // Canonical text that parses back to an equivalent level. Only
  // non-default directives are written; comments and the author's
  // layout are not kept (use `LevelText` to edit text in place).
  serialize(): string {
    const meta = this.meta;
    const header: string[] = [];
    if (meta.name) header.push(`# name: ${meta.name}`);
    if (meta.tileset && meta.tileset !== Level.DEFAULT_TILESET) header.push(`# tileset: ${meta.tileset}`);
    if (meta.theme && meta.theme !== Theme.Sky) header.push(`# theme: ${meta.theme}`);
    if (meta.declared) header.push(`# size: ${meta.declared.w}x${meta.declared.h}`);
    if (meta.backgroundImage) header.push(`# background-image: ${meta.backgroundImage}`);
    if (meta.pickupRequired != null && meta.pickupRequired !== 'all') {
      header.push(`# pickup-required: ${meta.pickupRequired}`);
    }
    if (meta.viewport && typeof meta.viewport === 'object') {
      header.push(`# viewport: ${meta.viewport.w}x${meta.viewport.h}`);
    }
    return [...header, ...this.grid].join('\n');
  }

  toString(): string {
    return this.serialize();
  }
}
