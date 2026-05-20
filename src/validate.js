// Edit-time lint. Pure: parsed level in, array of issues out (design §2, §5).
// Each issue: { line, col, severity: 'error'|'warn', message }.
// line/col are 1-based; line is the original file line (from parsed.rows).
import { DEFAULT_LEGEND, roleOf } from './level.js';

// `legend` is the active tileset's char-keyed legend (v8). Defaults to the
// Dirt set so existing callers/tests are unchanged. Role-driven checks
// (v11) consult `roleOf(legend, char)` instead of literal glyph chars, so
// a tileset can ship multiple hazard / pickup chars (TDD v11 §6).
export function validate(parsed, legend = DEFAULT_LEGEND) {
  const { grid, rows, meta } = parsed;
  const issues = [];
  const at = (r) => (rows[r] ? rows[r].line : 1);

  // Rule: no undefined glyphs.
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const g = grid[r][c];
      if (!(g in legend)) {
        issues.push({
          line: at(r),
          col: c + 1,
          severity: 'error',
          message: `undefined glyph '${g}'`,
        });
      }
    }
  }

  // Rule: exactly one cell of role:player. Any glyph char whose legend
  // entry resolves to role 'player' counts (today every shipped tileset
  // uses 'P', but the rule is role-driven so a tileset could rebind it).
  const spawns = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (roleOf(legend, grid[r][c]) === 'player') spawns.push({ r, c });
    }
  }
  if (spawns.length === 0) {
    issues.push({
      line: 1,
      col: 1,
      severity: 'error',
      message: 'no player spawn (expected exactly one)',
    });
  } else if (spawns.length > 1) {
    // Flag every spawn after the first so each is locatable.
    for (let i = 1; i < spawns.length; i++) {
      issues.push({
        line: at(spawns[i].r),
        col: spawns[i].c + 1,
        severity: 'error',
        message: `extra player spawn (only one allowed)`,
      });
    }
  }

  // Rule: at least one cell of role:exit (warn if none — playtest gate
  // promotes this to a hard block since the win is otherwise unreachable).
  const hasExit = grid.some((row) => {
    for (const ch of row) if (roleOf(legend, ch) === 'exit') return true;
    return false;
  });
  if (!hasExit) {
    issues.push({
      line: 1,
      col: 1,
      severity: 'warn',
      message: 'no exit in level',
    });
  }

  // Rule: declared dimensions match actual.
  if (meta.declared) {
    if (rows.length !== meta.declared.h) {
      issues.push({
        line: 1,
        col: 1,
        severity: 'error',
        message: `declared height ${meta.declared.h} but found ${rows.length} rows`,
      });
    }
    for (let r = 0; r < rows.length; r++) {
      if (rows[r].text.length > meta.declared.w) {
        issues.push({
          line: rows[r].line,
          col: meta.declared.w + 1,
          severity: 'error',
          message: `row exceeds declared width ${meta.declared.w} (${rows[r].text.length} chars)`,
        });
      }
    }
  }

  return issues;
}
