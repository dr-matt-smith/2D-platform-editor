import { Legend, LevelValidator, Role, Severity } from '@2d-platform/level-format';
import type { LevelData } from '@2d-platform/level-format';
import type { GateResult } from './GateResult.ts';

// Decides whether a level can be playtested. It reuses the editor's
// validator rather than adding rules of its own, and blocks on:
//   - any error-severity validation issue (an undefined glyph, not exactly
//     one player spawn, a size mismatch, ...);
//   - no exit anywhere in the grid. The editor only *warns* about that (a
//     level can be a work in progress), but a playtest could never be won
//     without one, so the gate is deliberately stricter than the lint.
// Warnings never block. The exit is found by its role in the legend, not
// by the character 'E', so a tileset that rebinds the exit still works.
export class PlaytestGate {
  constructor(private readonly legend: Legend = Legend.DEFAULT) {}

  check(level: LevelData): GateResult {
    const issues = new LevelValidator(this.legend).validate(level);
    const reasons = issues.filter((i) => i.severity === Severity.Error);

    if (!this.hasExit(level)) {
      reasons.push({
        line: 1,
        col: 1,
        severity: Severity.Error,
        message: 'playtest needs an exit to reach',
      });
    }

    return { ok: reasons.length === 0, reasons };
  }

  private hasExit(level: LevelData): boolean {
    return level.grid.some((row) => {
      for (const ch of row) if (this.legend.roleOf(ch) === Role.Exit) return true;
      return false;
    });
  }
}
