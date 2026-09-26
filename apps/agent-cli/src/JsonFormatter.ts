import type { LevelReport } from './LevelReport.ts';
import type { ReportFormatter } from './ReportFormatter.ts';
import type { SweepSummary } from './SweepSummary.ts';

// Reports as JSON for other tools (`--json`). The report objects are the
// JSON shape, so this is a straight stringify. A sweep prints one object at
// the end, so nothing streams while it runs.
export class JsonFormatter implements ReportFormatter {
  report(report: LevelReport): string {
    return JsonFormatter.stringify(report);
  }

  sweepHeader(): null {
    return null;
  }

  sweepRow(): null {
    return null;
  }

  sweepSummary(summary: SweepSummary, reports: readonly LevelReport[]): string {
    return JsonFormatter.stringify({ summary, levels: reports });
  }

  private static stringify(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}
