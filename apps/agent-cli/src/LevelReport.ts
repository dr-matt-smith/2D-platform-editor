// The report for one level: plain data, because it *is* the `--json`
// output (README.md, "JSON shape"). `status` says which fields are present.
import type { ValidationIssue } from '@2d-platform/level-format';
import type { Recording, SimResult, SolutionStats, TraceEntry, UnreachableGoal } from '@2d-platform/agent';
import type { ReportStatus } from './ReportStatus.ts';

// Which level a report is about.
export interface LevelInfo {
  // Manifest id, or null when the level was given as a file path.
  id: string | null;
  name: string;
  path: string;
  tileset: string;
  width: number;
  height: number;
}

// One winning solution, minus the planner's internal search graph.
export interface SolutionReport {
  stats: SolutionStats;
  // Frame-indexed key events; replay with the engine's ScriptedInput.
  recording: Recording;
  trace: TraceEntry[];
  // Goals skipped (e.g. optional pickups when `# pickup-required` < all).
  unreachable: UnreachableGoal[];
}

// The fields every report has, whatever its status.
interface ReportBase {
  level: LevelInfo;
  // Non-blocking problems: validation warnings, an unknown tileset.
  warnings: ValidationIssue[];
}

// The level failed validation; the agent was not run.
export interface InvalidReport extends ReportBase {
  status: ReportStatus.Invalid;
  errors: ValidationIssue[];
}

// The agent solved the level.
export interface SolvedReport extends ReportBase {
  status: ReportStatus.Solved;
  budgetMs: number;
  elapsedMs: number;
  // Up to 5 distinct solutions, fewest frames first.
  solutions: SolutionReport[];
}

// The agent ran out of ideas or time.
export interface UnsolvedReport extends ReportBase {
  status: ReportStatus.Unsolved;
  budgetMs: number;
  elapsedMs: number;
  attempts: number;
  // Human-readable explanations, most important first.
  reasons: string[];
  lastSim: SimResult | null;
  unreachable: UnreachableGoal[];
}

// Any report; narrow it by checking `status`.
export type LevelReport = InvalidReport | SolvedReport | UnsolvedReport;
