import { LevelValidator, Severity } from '@2d-platform/level-format';
import type { Level } from '@2d-platform/level-format';
import { FailureReason, GoalKind, LevelTester, SimOutcome } from '@2d-platform/agent';
import type { LevelTestFailure, PhysicsAdapter } from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';
import { ReportStatus } from './ReportStatus.ts';
import type { LevelInfo, LevelReport } from './LevelReport.ts';
import type { PreparedLevel } from './PreparedLevel.ts';

// Validates a level, runs the agent on it, and sums up the outcome as a
// LevelReport. No I/O and no formatting: a ReportFormatter turns the
// report into text or JSON.
export class LevelSolver {
  // The engine the agent simulates with. The default is this repo's JS
  // engine; the agent only needs the PhysicsAdapter interface.
  constructor(private readonly adapter: PhysicsAdapter = jsAdapter) {}

  // Solve `level` within `budgetMs` of search time.
  async solve(level: PreparedLevel, budgetMs: number): Promise<LevelReport> {
    const { parsed, legend } = level;
    const info = LevelSolver.levelInfo(level);

    const issues = new LevelValidator(legend).validate(parsed);
    const errors = issues.filter((i) => i.severity === Severity.Error);
    const warnings = issues.filter((i) => i.severity === Severity.Warn);
    if (level.tilesetWarning) {
      warnings.unshift({ line: 1, col: 1, severity: Severity.Warn, message: level.tilesetWarning });
    }
    if (errors.length > 0) return { status: ReportStatus.Invalid, level: info, warnings, errors };

    // The tileset argument only affects sprites, so headless runs pass null.
    const start = performance.now();
    const result = await LevelTester.create(this.adapter).test(parsed, legend.toRecord(), null, {
      maxRuntimeMs: budgetMs,
    });
    const elapsedMs = Math.round(performance.now() - start);

    if (result.ok) {
      return {
        status: ReportStatus.Solved,
        level: info,
        warnings,
        budgetMs,
        elapsedMs,
        solutions: result.solutions.map((s) => ({
          stats: s.stats,
          recording: s.recording,
          trace: s.plan.trace,
          unreachable: s.unreachable,
        })),
      };
    }
    return {
      status: ReportStatus.Unsolved,
      level: info,
      warnings,
      budgetMs,
      elapsedMs,
      attempts: result.attempts,
      reasons: LevelSolver.describeFailure(result, parsed),
      lastSim: result.lastSim,
      unreachable: result.lastPlan.unreachable,
    };
  }

  // Explain a failed search in sentences, following the editor's agent dialog.
  static describeFailure(result: LevelTestFailure, parsed: Level): string[] {
    const reasons: string[] = [];
    if (result.reason === FailureReason.TimeoutDuringPlan) {
      reasons.push('Ran out of time while building the first plan; try a larger --budget.');
    }
    for (const goal of result.lastPlan.unreachable) {
      const what = goal.kind === GoalKind.Exit ? 'Exit' : 'Pickup';
      reasons.push(`${what} at ${LevelSolver.cellLocation(parsed, goal)} is unreachable from the spawn.`);
    }
    const sim = result.lastSim;
    if (sim?.outcome === SimOutcome.Dead) {
      const x = Math.round(sim.pos.x);
      const y = Math.round(sim.pos.y);
      reasons.push(`Last simulation: player died at world (${x}, ${y}) on frame ${sim.frame}.`);
    } else if (sim?.outcome === SimOutcome.Timeout) {
      reasons.push(`Last simulation timed out at frame ${sim.frame} without reaching the exit.`);
    }
    if (reasons.length === 0) reasons.push('No solution found within the budget.');
    return reasons;
  }

  private static levelInfo(level: PreparedLevel): LevelInfo {
    const { meta } = level.parsed;
    return {
      id: level.id,
      name: meta.name ?? level.id ?? LevelSolver.baseName(level.path),
      path: level.path,
      tileset: meta.tileset,
      width: meta.width,
      height: meta.height,
    };
  }

  // A grid cell as the file line/column the author sees in their editor.
  private static cellLocation(parsed: Level, cell: { r: number; c: number }): string {
    const line = parsed.rows[cell.r]?.line ?? cell.r + 1;
    return `line ${line}, col ${cell.c + 1}`;
  }

  private static baseName(path: string): string {
    const file = path.split(/[\\/]/).pop() ?? path;
    return file.replace(/\.txt$/, '');
  }
}
