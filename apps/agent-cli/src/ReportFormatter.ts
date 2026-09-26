import type { LevelReport } from './LevelReport.ts';
import type { SweepSummary } from './SweepSummary.ts';

// Turns reports into the text the CLI prints. Commands hold one of these
// without knowing which: TextFormatter for people, JsonFormatter for tools.
//
// A sweep prints as it goes (a header, then a row per level as it finishes)
// and ends with a summary. A formatter that has nothing to print for a step
// returns null.
export interface ReportFormatter {
  // One level's report.
  report(report: LevelReport): string;
  // Printed before the first level of a sweep. `idWidth` is the widest level id.
  sweepHeader(idWidth: number): string | null;
  // Printed as each level of a sweep finishes.
  sweepRow(report: LevelReport, idWidth: number): string | null;
  // Printed once the sweep is done.
  sweepSummary(summary: SweepSummary, reports: readonly LevelReport[]): string;
}
