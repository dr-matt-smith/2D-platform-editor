// Validate a level, run the agent on it, and summarise the outcome as a
// plain-data report. No I/O and no formatting: format.ts turns the report
// into text or JSON.
import { validate } from '@2d-platform/level-format';
import type { ParsedLevel, ValidationIssue } from '@2d-platform/level-format';
import { testLevel } from '@2d-platform/agent';
import type {
  Recording,
  SimResult,
  SolutionStats,
  TestLevelFailure,
  TraceEntry,
  UnreachableGoal,
} from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';
import type { PreparedLevel } from './levelSource.ts';

/** Which level a report is about. */
export interface LevelInfo {
  /** Manifest id, or null when the level was given as a file path. */
  id: string | null;
  name: string;
  path: string;
  tileset: string;
  width: number;
  height: number;
}

/** One winning solution, minus the planner's internal search graph. */
export interface SolutionReport {
  stats: SolutionStats;
  /** Frame-indexed key events; replay with the engine's ScriptedInput. */
  recording: Recording;
  trace: TraceEntry[];
  /** Goals skipped (e.g. optional pickups when `# pickup-required` < all). */
  unreachable: UnreachableGoal[];
}

interface ReportBase {
  level: LevelInfo;
  /** Non-blocking problems: validation warnings, an unknown tileset. */
  warnings: ValidationIssue[];
}

export interface InvalidReport extends ReportBase {
  status: 'invalid';
  errors: ValidationIssue[];
}

export interface SolvedReport extends ReportBase {
  status: 'solved';
  budgetMs: number;
  elapsedMs: number;
  /** Up to 5 distinct solutions, fewest frames first. */
  solutions: SolutionReport[];
}

export interface UnsolvedReport extends ReportBase {
  status: 'unsolved';
  budgetMs: number;
  elapsedMs: number;
  attempts: number;
  /** Human-readable explanations, most important first. */
  reasons: string[];
  lastSim: SimResult | null;
  unreachable: UnreachableGoal[];
}

export type LevelReport = InvalidReport | SolvedReport | UnsolvedReport;

export interface SolveOptions {
  budgetMs: number;
}

export async function solveLevel(level: PreparedLevel, options: SolveOptions): Promise<LevelReport> {
  const { parsed, legend } = level;
  const info = levelInfo(level);

  const issues = validate(parsed, legend);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');
  if (level.tilesetWarning) {
    warnings.unshift({ line: 1, col: 1, severity: 'warn', message: level.tilesetWarning });
  }
  if (errors.length > 0) return { status: 'invalid', level: info, warnings, errors };

  // The tileset argument only affects sprites, so headless runs pass null.
  const start = performance.now();
  const result = await testLevel(parsed, legend, null, {
    adapter: jsAdapter,
    maxRuntimeMs: options.budgetMs,
  });
  const elapsedMs = Math.round(performance.now() - start);

  if (result.ok) {
    return {
      status: 'solved',
      level: info,
      warnings,
      budgetMs: options.budgetMs,
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
    status: 'unsolved',
    level: info,
    warnings,
    budgetMs: options.budgetMs,
    elapsedMs,
    attempts: result.attempts,
    reasons: describeFailure(result, parsed),
    lastSim: result.lastSim,
    unreachable: result.lastPlan.unreachable,
  };
}

/** Totals for an --all sweep. */
export interface SweepSummary {
  total: number;
  solved: number;
  unsolved: number;
  invalid: number;
  elapsedMs: number;
  /** Ids (or names) of the levels that were not solved. */
  failed: string[];
}

export function summarise(reports: readonly LevelReport[]): SweepSummary {
  const count = (status: LevelReport['status']) => reports.filter((r) => r.status === status).length;
  return {
    total: reports.length,
    solved: count('solved'),
    unsolved: count('unsolved'),
    invalid: count('invalid'),
    elapsedMs: reports.reduce((sum, r) => sum + (r.status === 'invalid' ? 0 : r.elapsedMs), 0),
    failed: reports.filter((r) => r.status !== 'solved').map((r) => r.level.id ?? r.level.name),
  };
}

function levelInfo(level: PreparedLevel): LevelInfo {
  const { meta } = level.parsed;
  return {
    id: level.id,
    name: meta.name ?? level.id ?? baseName(level.path),
    path: level.path,
    tileset: meta.tileset,
    width: meta.width,
    height: meta.height,
  };
}

/** Explain a failed search, following the editor's agent dialog. */
export function describeFailure(result: TestLevelFailure, parsed: ParsedLevel): string[] {
  const reasons: string[] = [];
  if (result.reason === 'timeout-during-plan') {
    reasons.push('Ran out of time while building the first plan; try a larger --budget.');
  }
  for (const goal of result.lastPlan.unreachable) {
    const what = goal.kind === 'exit' ? 'Exit' : 'Pickup';
    reasons.push(`${what} at ${cellLocation(parsed, goal)} is unreachable from the spawn.`);
  }
  const sim = result.lastSim;
  if (sim?.outcome === 'dead') {
    const x = Math.round(sim.pos.x);
    const y = Math.round(sim.pos.y);
    reasons.push(`Last simulation: player died at world (${x}, ${y}) on frame ${sim.frame}.`);
  } else if (sim?.outcome === 'timeout') {
    reasons.push(`Last simulation timed out at frame ${sim.frame} without reaching the exit.`);
  }
  if (reasons.length === 0) reasons.push('No solution found within the budget.');
  return reasons;
}

// A grid cell as the file line/column the author sees in their editor.
function cellLocation(parsed: ParsedLevel, cell: { r: number; c: number }): string {
  const line = parsed.rows[cell.r]?.line ?? cell.r + 1;
  return `line ${line}, col ${cell.c + 1}`;
}

function baseName(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? path;
  return file.replace(/\.txt$/, '');
}
