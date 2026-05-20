// Pure launch gate (TDD v9 design §4.1, v11 design §6/§7). Decides
// whether the current buffer is playable, reusing the editor's existing
// `validate` — no new lint rules. No DOM; unit-tested headless.
//
// Blocks on:
//  - any `error`-severity validator issue (undefined glyph, not exactly
//    one role:player, declared-size mismatch, …); and
//  - no role:exit in the grid — the editor only *warns* on a missing
//    exit (a level can be a WIP), but a playtest's win condition (all
//    pickups, then reach an exit) is unreachable without one, so the
//    gate is deliberately STRICTER than the editor lint.
//
// v11: "exit" is matched **by role** (via the active legend), not by
// the literal char 'E', so a tileset rebinding the exit char still
// playtests cleanly.
//
// `warn`-severity issues do not block.
import { validate } from '../validate.js';
import { DEFAULT_LEGEND, roleOf } from '../level.js';

/**
 * @param parsed result of level.js `parse()`
 * @param legend active tileset legend (passed straight to `validate`)
 * @returns { ok: boolean, reasons: Array<{line,col,severity,message}> }
 *          `reasons` are the blocking issues, in validator-issue shape.
 */
export function playtestGate(parsed, legend = DEFAULT_LEGEND) {
  const issues = validate(parsed, legend);
  const reasons = issues.filter((i) => i.severity === 'error');

  const hasExit = parsed.grid.some((row) => {
    for (const ch of row) if (roleOf(legend, ch) === 'exit') return true;
    return false;
  });
  if (!hasExit) {
    reasons.push({
      line: 1,
      col: 1,
      severity: 'error',
      message: 'playtest needs an exit to reach',
    });
  }

  return { ok: reasons.length === 0, reasons };
}
