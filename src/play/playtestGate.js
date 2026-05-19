// Pure launch gate (TDD v9 design §4.1). Decides whether the current buffer
// is playable, reusing the editor's existing `validate` — no new lint rules.
// No DOM; unit-tested headless.
//
// Blocks on:
//  - any `error`-severity validator issue (undefined glyph, not exactly one
//    P, declared-size mismatch, …); and
//  - no `E` in the grid — the editor only *warns* on a missing exit (a
//    level can be a WIP), but a playtest's win condition (all `o`, then
//    reach `E`) is unreachable without one, so the gate is deliberately
//    STRICTER than the editor lint and promotes it to a blocker.
//
// `warn`-severity issues do not block.
import { validate } from '../validate.js';

/**
 * @param parsed result of level.js `parse()`
 * @param legend active tileset legend (passed straight to `validate`)
 * @returns { ok: boolean, reasons: Array<{line,col,severity,message}> }
 *          `reasons` are the blocking issues, in validator-issue shape.
 */
export function playtestGate(parsed, legend) {
  const issues = validate(parsed, legend);
  const reasons = issues.filter((i) => i.severity === 'error');

  const hasExit = parsed.grid.some((row) => row.includes('E'));
  if (!hasExit) {
    reasons.push({
      line: 1,
      col: 1,
      severity: 'error',
      message: 'playtest needs an exit (E) to reach',
    });
  }

  return { ok: reasons.length === 0, reasons };
}
