// Level format: optional `# key: value` header directives, then an ASCII grid.
// `//` lines are comments stripped at parse time. See TDDs/1_design/version01_design.md §4.

// Single source of truth for valid glyphs, shared by the renderer and validator
// so the two cannot disagree (design §4).
export const LEGEND = {
  '.': { name: 'empty', role: 'background' },
  '#': { name: 'wall', role: 'terrain' },
  P: { name: 'player spawn', role: 'entity' },
  '^': { name: 'hazard', role: 'terrain' },
  o: { name: 'collectible', role: 'entity' },
  E: { name: 'exit', role: 'entity' },
};

export const BACKGROUND_GLYPH = '.';

const DIRECTIVE = /^#\s*(\w+)\s*:\s*(.+?)\s*$/;
const SIZE = /^(\d+)\s*x\s*(\d+)$/i;

const isComment = (line) => line.trimStart().startsWith('//');

/**
 * Parse level text into { meta, grid, rows }.
 * - meta: { name, width, height, declared: {w,h} | null }
 * - grid: array of equal-width rows, right-padded with the background glyph
 * - rows: per grid row { text, line } where `line` is the original 1-based
 *   file line number — used by the validator for line/col reporting.
 */
export function parse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

  const meta = { name: null, width: 0, height: 0, declared: null };
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
        else if (key === 'size') {
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

/** Serialize back to canonical text that re-parses to an equivalent level. */
export function serialize({ meta, grid }) {
  const header = [];
  if (meta?.name) header.push(`# name: ${meta.name}`);
  if (meta?.declared) header.push(`# size: ${meta.declared.w}x${meta.declared.h}`);
  return [...header, ...grid].join('\n');
}
