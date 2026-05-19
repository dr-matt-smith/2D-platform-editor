// Level format: optional `# key: value` header directives, then an ASCII grid.
// `//` lines are comments stripped at parse time. See TDDs/1_design/version01_design.md §4.

// Default (Dirt) glyph legend, char-keyed: the offline fallback and
// `validate`'s default. The active tileset's legend is derived from its
// tile_lookup.json via `buildLegend` (v8). Colours mirror src/palette.js
// (image-less swatches); `image` is tileset-relative or null. `LEGEND` is a
// deprecated alias kept so existing importers/tests keep working.
export const DEFAULT_LEGEND = {
  '.': { name: 'Empty', role: 'background', image: null, color: '#1b2a3a' },
  '#': { name: 'Filled', role: 'terrain', image: 'tiles/01_dirt_top.png', color: null },
  P: { name: 'Player spawn', role: 'entity', image: null, color: '#3498db' },
  '^': { name: 'Hazard', role: 'terrain', image: null, color: '#c0392b' },
  o: { name: 'Pickup', role: 'entity', image: null, color: '#f1c40f' },
  E: { name: 'Exit', role: 'entity', image: null, color: '#2ecc71' },
};
export const LEGEND = DEFAULT_LEGEND;

// Build a char-keyed legend from a tileset's tile_lookup.json `glyphs`
// section. Falls back to the Dirt default if absent. Pure.
export function buildLegend(lookup) {
  const glyphs = lookup?.glyphs;
  if (!glyphs) return DEFAULT_LEGEND;
  const legend = {};
  for (const g of Object.values(glyphs)) {
    if (!g?.char) continue;
    legend[g.char] = {
      name: g.name ?? g.char,
      role: g.role ?? 'terrain',
      image: g.image ?? null,
      color: g.color ?? null,
    };
  }
  return legend;
}

export const BACKGROUND_GLYPH = '.';
export const DEFAULT_TILESET = 'Dirt_Platformer_Tiles';

// Visual themes: 'sky' = night background + moon/stars + grass; 'cave' = dark
// dirt background, no celestial decor. Default 'sky'.
export const THEMES = new Set(['sky', 'cave']);

const DIRECTIVE = /^#\s*(\w+)\s*:\s*(.+?)\s*$/;
const SIZE = /^(\d+)\s*x\s*(\d+)$/i;

const isComment = (line) => line.trimStart().startsWith('//');

/**
 * Parse level text into { meta, grid, rows }.
 * - meta: { name, theme, tileset, width, height, declared: {w,h} | null }
 * - grid: array of equal-width rows, right-padded with the background glyph
 * - rows: per grid row { text, line } where `line` is the original 1-based
 *   file line number — used by the validator for line/col reporting.
 */
export function parse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  const meta = {
    name: null,
    theme: 'sky',
    tileset: DEFAULT_TILESET,
    width: 0,
    height: 0,
    declared: null,
  };
  const rawRows = []; // { text, line }
  let inGrid = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line)) continue;

    if (!inGrid) {
      const m = line.match(DIRECTIVE);
      if (m) {
        // A grid row of walls ("####") never matches the key:value shape, so
        // directives stay unambiguous while still inside the header region.
        const key = m[1].toLowerCase();
        const value = m[2];
        if (key === 'name') meta.name = value;
        else if (key === 'tileset') meta.tileset = value;
        else if (key === 'theme') {
          meta.theme = THEMES.has(value.toLowerCase()) ? value.toLowerCase() : 'sky';
        } else if (key === 'size') {
          const s = value.match(SIZE);
          if (s) meta.declared = { w: Number(s[1]), h: Number(s[2]) };
        }
        continue;
      }
      inGrid = true; // first non-comment, non-directive line starts the grid
    }
    rawRows.push({ text: line, line: i + 1 });
  }

  const width = meta.declared
    ? meta.declared.w
    : rawRows.reduce((max, r) => Math.max(max, r.text.length), 0);

  const grid = rawRows.map((r) =>
    r.text.length >= width
      ? r.text
      : r.text + BACKGROUND_GLYPH.repeat(width - r.text.length),
  );

  meta.width = width;
  meta.height = rawRows.length;
  return { meta, grid, rows: rawRows };
}

// Normalise corners and clamp to the grid; returns null if there is no grid.
function rectBounds(grid, x0, y0, x1, y1) {
  const h = grid.length;
  const w = h ? grid[0].length : 0;
  if (!h || !w) return null;
  const clamp = (v, max) => Math.max(0, Math.min(max, v));
  return {
    x0: clamp(Math.min(x0, x1), w - 1),
    x1: clamp(Math.max(x0, x1), w - 1),
    y0: clamp(Math.min(y0, y1), h - 1),
    y1: clamp(Math.max(y0, y1), h - 1),
  };
}

// Apply `fn(col,row) -> bool` over the clamped rectangle, writing `glyph`
// where it returns true. Pure: rows are rebuilt, the input grid is untouched.
function paintRect(grid, x0, y0, x1, y1, glyph, fn) {
  const b = rectBounds(grid, x0, y0, x1, y1);
  if (!b) return grid.slice();
  const g = glyph[0];
  return grid.map((row, r) => {
    if (r < b.y0 || r > b.y1) return row;
    const cells = row.split('');
    for (let c = b.x0; c <= b.x1; c++) if (fn(c, r, b)) cells[c] = g;
    return cells.join('');
  });
}

/** Fill a rectangle (corners in any order, clamped) with `glyph`. */
export function fillRect(grid, x0, y0, x1, y1, glyph) {
  return paintRect(grid, x0, y0, x1, y1, glyph, () => true);
}

/** Draw only the border of a rectangle with `glyph` (hollow interior). */
export function outlineRect(grid, x0, y0, x1, y1, glyph) {
  return paintRect(
    grid,
    x0,
    y0,
    x1,
    y1,
    glyph,
    (c, r, b) => r === b.y0 || r === b.y1 || c === b.x0 || c === b.x1,
  );
}

/**
 * Pure buffer edit: set/replace/remove the `# tileset:` directive without
 * disturbing other headers, comments, or the grid. Used by the tileset menu
 * to flip the active tileset on the open buffer (v9+).
 *
 *   - id === defaultId AND no existing directive → text unchanged.
 *   - id === defaultId AND directive exists       → that line is removed
 *     (mirrors `serialize`'s "emit only when non-default" rule).
 *   - id !== defaultId AND directive exists       → that line is rewritten.
 *   - id !== defaultId AND no directive           → a new `# tileset: <id>`
 *     line is inserted into the header region (after any existing leading
 *     `#`-directives and `//`-comments, before the grid).
 */
export function setTilesetDirective(text, id, defaultId = DEFAULT_TILESET) {
  const lines = text.split('\n');
  const tilesetRe = /^#\s*tileset\s*:/i;
  const directiveRe = /^#\s*\w+\s*:/;
  const idx = lines.findIndex((l) => tilesetRe.test(l));

  if (id === defaultId) {
    if (idx >= 0) lines.splice(idx, 1);
    return lines.join('\n');
  }
  const newLine = `# tileset: ${id}`;
  if (idx >= 0) {
    lines[idx] = newLine;
    return lines.join('\n');
  }
  // Insert into the header band: after the last consecutive leading
  // directive/comment line, before the first grid row.
  let at = 0;
  while (at < lines.length && (directiveRe.test(lines[at]) || isComment(lines[at]))) at++;
  lines.splice(at, 0, newLine);
  return lines.join('\n');
}

/** Serialize back to canonical text that re-parses to an equivalent level. */
export function serialize({ meta, grid }) {
  const header = [];
  if (meta?.name) header.push(`# name: ${meta.name}`);
  if (meta?.tileset && meta.tileset !== DEFAULT_TILESET)
    header.push(`# tileset: ${meta.tileset}`);
  if (meta?.theme && meta.theme !== 'sky') header.push(`# theme: ${meta.theme}`);
  if (meta?.declared) header.push(`# size: ${meta.declared.w}x${meta.declared.h}`);
  return [...header, ...grid].join('\n');
}
