import { ReportStatus } from './ReportStatus.ts';
import type { LevelReport } from './LevelReport.ts';
import type { SweepTotals } from './SweepTotals.ts';

// Totals for an --all sweep. Its own fields are exactly SweepTotals, so it
// serialises to the same JSON; the class adds the questions callers ask.
export class SweepSummary implements SweepTotals {
  readonly total: number;
  readonly solved: number;
  readonly unsolved: number;
  readonly invalid: number;
  readonly elapsedMs: number;
  readonly failed: string[];

  // Fields are assigned in this order so the JSON keys keep their order.
  constructor(totals: SweepTotals) {
    this.total = totals.total;
    this.solved = totals.solved;
    this.unsolved = totals.unsolved;
    this.invalid = totals.invalid;
    this.elapsedMs = totals.elapsedMs;
    this.failed = totals.failed;
  }

  // Count the outcomes of a finished sweep.
  static of(reports: readonly LevelReport[]): SweepSummary {
    const count = (status: ReportStatus) => reports.filter((r) => r.status === status).length;
    return new SweepSummary({
      total: reports.length,
      solved: count(ReportStatus.Solved),
      unsolved: count(ReportStatus.Unsolved),
      invalid: count(ReportStatus.Invalid),
      elapsedMs: reports.reduce((sum, r) => sum + (r.status === ReportStatus.Invalid ? 0 : r.elapsedMs), 0),
      failed: reports.filter((r) => r.status !== ReportStatus.Solved).map((r) => r.level.id ?? r.level.name),
    });
  }

  // True when every level in the sweep was solved.
  get allSolved(): boolean {
    return this.solved === this.total;
  }
}
