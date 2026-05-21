// Level format: optional `# key: value` header directives, then an ASCII grid.
// `//` lines are comments stripped at parse time. See TDDs/1_design/version01_design.md §4.

// v11 role taxonomy. Every legend entry's `role` is one of these once
// `buildLegend` has normalised it (TDD v11 §3). Everything downstream
// (validator, playtest adapter, gate) keys behaviour off these names.
// v18: `foreground` joins the role taxonomy as a decoration variant
// that renders OVER the interactable tile + entities (renderer Pass 4c),
// whereas the existing `decoration` / `background` roles render UNDER
// (Pass 4a). Inert in playtest — visual only.
export const V11_ROLES = Object.freeze(
  new Set(['background', 'terrain', 'player', 'exit', 'hazard', 'pickup', 'decoration', 'foreground']),
);

// Legacy `tile_lookup.json` files use coarse role names ('entity'/'terrain')
// with the GLYPHS KEY as the real source of truth (`glyphs.player`, `glyphs.
// hazard`, …). The resolver below maps those keys onto the v11 specific
// roles so v10 lookups (Dirt + the four user packs) keep working unchanged.
const ROLE_FROM_KEY = Object.freeze({
  empty: 'background',
  filled: 'terrain',
  player: 'player',
  exit: 'exit',
  hazard: 'hazard',
  pickup: 'pickup',
});

// Resolve a glyph entry's role per TDD v11 §11 (locked: key-inference wins
// for legacy keys; for any other key the explicit `role` field is the
// source of truth).
function resolveRole(key, glyphEntry) {
  if (key in ROLE_FROM_KEY) return ROLE_FROM_KEY[key];
  const r = glyphEntry?.role;
  return V11_ROLES.has(r) ? r : 'unknown';
}

// Default (Dirt) glyph legend, char-keyed: the offline fallback and
// `validate`'s default. The active tileset's legend is derived from its
// tile_lookup.json via `buildLegend`. `role` values are v11 specifics
// (TDD v11 §3); v10 declared 'entity'/'terrain' here but nothing read
// `.role` from this constant, so the rename is consumer-neutral.
// Colours mirror src/palette.js (image-less swatches); `image` is
// tileset-relative or null. `LEGEND` is a deprecated alias.
export const DEFAULT_LEGEND = {
  '.': { name: 'Empty', role: 'background', image: null, color: '#1b2a3a' },
  '#': { name: 'Filled', role: 'terrain', image: 'tiles/01_dirt_top.png', color: null },
  P: { name: 'Player spawn', role: 'player', image: null, color: '#3498db' },
  '^': { name: 'Hazard', role: 'hazard', image: null, color: '#c0392b' },
  o: { name: 'Pickup', role: 'pickup', image: null, color: '#f1c40f' },
  E: { name: 'Exit', role: 'exit', image: null, color: '#2ecc71' },
};
export const LEGEND = DEFAULT_LEGEND;

// Build a char-keyed legend from a tileset's tile_lookup.json `glyphs`
// section. Falls back to the Dirt default if absent. Pure. Each entry's
// `role` is resolved to a v11 specific role (TDD v11 §3); v10 lookups
// declaring `role: 'entity'`/`'terrain'` are handled by the key-inference
// fallback so no data migration is required.
export function buildLegend(lookup) {
  const glyphs = lookup?.glyphs;
  if (!glyphs) return DEFAULT_LEGEND;
  const legend = {};
  for (const [key, g] of Object.entries(glyphs)) {
    if (!g?.char) continue;
    legend[g.char] = {
      name: g.name ?? g.char,
      role: resolveRole(key, g),
      image: g.image ?? null,
      color: g.color ?? null,
    };
  }
  return legend;
}

// Char → v11 role accessor. Returns `null` for chars not in the legend
// (the validator uses this to flag undefined glyphs). Used by validate,
// the playtest adapter, the gate, and anywhere downstream of v11.
export const roleOf = (legend, char) => legend?.[char]?.role ?? null;

export const BACKGROUND_GLYPH = '.';
export const DEFAULT_TILESET = 'Dirt_Platformer_Tiles';

// Visual themes: 'sky' = night background + moon/stars + grass; 'cave' = dark
// dirt background, no celestial decor. Default 'sky'.
export const THEMES = new Set(['sky', 'cave']);

// v18: allow `-` in directive keys (`background-image`, `pickup-required`).
// Pre-v18 keys (`name`, `tileset`, `theme`, `size`) keep parsing
// unchanged — the broader character class is a superset.
const DIRECTIVE = /^#\s*([\w-]+)\s*:\s*(.+?)\s*$/;
const SIZE = /^(\d+)\s*x\s*(\d+)$/i;

// v19: viewport directive clamp. Matches the v8 level-size clamp shape
// (the New-level dialog clamps to [4, 200]). Out-of-range values are
// silently coerced rather than dropped — better authoring UX than a
// directive that gets silently removed because someone typed `300`.
export const VIEWPORT_MIN = 4;
export const VIEWPORT_MAX = 200;
const clampViewport = (n) =>
  Math.max(VIEWPORT_MIN, Math.min(VIEWPORT_MAX, Math.round(Number(n) || 0) || VIEWPORT_MIN));

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
    // v18 additions. Absent directives → defaults that preserve v17
    // behaviour: no background image, all pickups required to win.
    backgroundImage: null,
    pickupRequired: 'all',
    // v19 addition. Absent / `fit` → null → playtest shows the whole
    // world (the v18 behaviour). `{w, h}` → playtest mounts a
    // viewport-sized canvas and the camera scrolls.
    viewport: null,
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
        } else if (key === 'background-image' || key === 'backgroundimage') {
          // v18: pick a tileset.lookup.images entry by stable ID;
          // unknown IDs render as "no background" (renderer just
          // falls back to the SKY fill).
          meta.backgroundImage = value || null;
        } else if (key === 'pickup-required' || key === 'pickuprequired') {
          // v18: 'all' (default) | 0 (no minimum) | positive int.
          // Anything else → 'all' (the safe default; the playtest
          // gate's existing "no exit" warning still flags real
          // problems).
          const trimmed = value.trim().toLowerCase();
          if (trimmed === 'all') meta.pickupRequired = 'all';
          else if (/^\d+$/.test(trimmed)) meta.pickupRequired = Number(trimmed);
        } else if (key === 'viewport') {
          // v19: 'fit' (or unparseable) → null (= whole world, v18
          // default). 'WxH' (case-insensitive `x`) → {w, h} clamped
          // to [VIEWPORT_MIN, VIEWPORT_MAX]. Anything else → null.
          const trimmed = value.trim().toLowerCase();
          if (trimmed === 'fit') meta.viewport = null;
          else {
            const m2 = value.match(SIZE);
            if (m2) {
              const w = clampViewport(Number(m2[1]));
              const h = clampViewport(Number(m2[2]));
              meta.viewport = { w, h };
            }
          }
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

/**
 * v18: set/replace/remove the `# background-image:` directive on a
 * buffer without disturbing other headers or the grid. Mirrors
 * `setTilesetDirective`. Passing `null` or `''` removes the line
 * (default: no background image, solid SKY fill).
 */
export function setBackgroundImageDirective(text, id) {
  return setHeaderDirective(text, /^#\s*background-image\s*:/i, id, (v) =>
    `# background-image: ${v}`,
  );
}

/**
 * v19: set/replace/remove the `# viewport:` directive. Accepted
 * values: `null` / `'fit'` (default — removed from the buffer when
 * set), or `{w, h}` (clamped to [VIEWPORT_MIN, VIEWPORT_MAX]).
 */
export function setViewportDirective(text, value) {
  const normalised =
    value == null || value === 'fit'
      ? null
      : value && typeof value === 'object' && 'w' in value && 'h' in value
        ? `${clampViewport(value.w)}x${clampViewport(value.h)}`
        : null;
  return setHeaderDirective(
    text,
    /^#\s*viewport\s*:/i,
    normalised,
    (v) => `# viewport: ${v}`,
  );
}

/**
 * v18: set/replace/remove the `# pickup-required:` directive.
 * Accepted values: `'all'` (default — removed from the buffer when
 * set), `0` (no minimum, touch exit to win), or a positive integer
 * (collect at least N before exit becomes winnable).
 */
export function setPickupRequiredDirective(text, value) {
  const normalised =
    value === 'all' || value == null
      ? null // remove (default = all)
      : Number.isInteger(value) && value >= 0
        ? String(value)
        : null;
  return setHeaderDirective(
    text,
    /^#\s*pickup-required\s*:/i,
    normalised,
    (v) => `# pickup-required: ${v}`,
  );
}

// Internal: set / replace / remove a header directive line. `pattern`
// matches the existing line if any; `value` is the new payload (null →
// remove); `format` renders the payload into a `# key: value` line.
// Insert position: after the last consecutive leading directive /
// `//` comment, before the first grid row — same rule the v9
// `setTilesetDirective` uses.
function setHeaderDirective(text, pattern, value, format) {
  const lines = text.split('\n');
  const directiveRe = /^#\s*\w[\w-]*\s*:/;
  const idx = lines.findIndex((l) => pattern.test(l));
  if (value == null || value === '') {
    if (idx >= 0) lines.splice(idx, 1);
    return lines.join('\n');
  }
  const newLine = format(value);
  if (idx >= 0) {
    lines[idx] = newLine;
    return lines.join('\n');
  }
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
  if (meta?.backgroundImage) header.push(`# background-image: ${meta.backgroundImage}`);
  if (meta?.pickupRequired != null && meta.pickupRequired !== 'all')
    header.push(`# pickup-required: ${meta.pickupRequired}`);
  if (meta?.viewport && typeof meta.viewport === 'object')
    header.push(`# viewport: ${meta.viewport.w}x${meta.viewport.h}`);
  return [...header, ...grid].join('\n');
}
