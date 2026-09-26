import type { ValidationIssue } from '@2d-platform/level-format';
import { ReportStatus } from './ReportStatus.ts';
import type { LevelReport, SolvedReport } from './LevelReport.ts';
import type { ReportFormatter } from './ReportFormatter.ts';
import type { SweepSummary } from './SweepSummary.ts';

// Reports as aligned text for people: the default output.
export class TextFormatter implements ReportFormatter {
  // Longest problem list shown (JSON always has them all).
  static readonly MAX_LISTED_ISSUES = 10;
  // The engine steps at a fixed 60 frames per simulated second.
  private static readonly FPS = 60;
  private static readonly SOLUTION_HEADERS = [
    '#',
    'frames',
    'game time',
    'steps',
    'walks',
    'jumps',
    'drops',
    'score',
    'attempt',
  ];
  private static readonly SWEEP_HEADERS = ['level', 'result', 'solutions', 'best frames', 'jumps', 'time'];

  // --- single level ------------------------------------------------------

  report(report: LevelReport): string {
    const { level } = report;
    const lines = [
      `Level:    ${level.name}  (${level.path})`,
      `Tileset:  ${level.tileset}, ${level.width}x${level.height}`,
    ];
    if (report.warnings.length > 0) {
      lines.push('Warnings:', ...TextFormatter.issueList(report.warnings));
    }

    if (report.status === ReportStatus.Invalid) {
      lines.push('Solvable: no, the level is invalid', 'Problems:');
      lines.push(...TextFormatter.issueList(report.errors));
    } else if (report.status === ReportStatus.Unsolved) {
      lines.push(
        `Solvable: no solution found in ${TextFormatter.duration(report.elapsedMs)} ` +
          `(budget ${TextFormatter.duration(report.budgetMs)}, ${TextFormatter.plural(report.attempts, 'attempt')})`,
        'Reasons:',
        ...report.reasons.map((r) => `  - ${r}`),
      );
    } else {
      const count = TextFormatter.plural(report.solutions.length, 'distinct solution');
      lines.push(
        `Solvable: yes, ${count} found in ${TextFormatter.duration(report.elapsedMs)} ` +
          `(budget ${TextFormatter.duration(report.budgetMs)})`,
        '',
        ...TextFormatter.solutionsTable(report),
      );
    }
    return lines.join('\n');
  }

  // One validation issue, e.g. "line 3, col 5: error: unknown glyph 'Q'".
  static issueLine(issue: ValidationIssue): string {
    return `line ${issue.line}, col ${issue.col}: ${issue.severity}: ${issue.message}`;
  }

  // --- --all sweep -------------------------------------------------------

  sweepHeader(idWidth: number): string {
    return TextFormatter.sweepLine(TextFormatter.SWEEP_HEADERS, idWidth);
  }

  sweepRow(report: LevelReport, idWidth: number): string {
    const id = report.level.id ?? report.level.name;
    if (report.status === ReportStatus.Solved) {
      const best = report.solutions[0].stats;
      const numbers = [report.solutions.length, best.frame, best.jumps].map(String);
      return TextFormatter.sweepLine([id, 'solved', ...numbers, TextFormatter.duration(report.elapsedMs)], idWidth);
    }
    const time = report.status === ReportStatus.Unsolved ? TextFormatter.duration(report.elapsedMs) : '-';
    return TextFormatter.sweepLine([id, report.status.toUpperCase(), '-', '-', '-', time], idWidth);
  }

  // The summary line, after a blank line to set it off from the table.
  sweepSummary(summary: SweepSummary): string {
    return `\n${this.summaryLine(summary)}`;
  }

  // e.g. "Summary: 5/6 solved, 1 unsolved in 3.4s (failed: fred)".
  summaryLine(summary: SweepSummary): string {
    const parts = [`${summary.solved}/${summary.total} solved`];
    if (summary.unsolved > 0) parts.push(`${summary.unsolved} unsolved`);
    if (summary.invalid > 0) parts.push(`${summary.invalid} invalid`);
    const failed = summary.failed.length > 0 ? ` (failed: ${summary.failed.join(', ')})` : '';
    return `Summary: ${parts.join(', ')} in ${TextFormatter.duration(summary.elapsedMs)}${failed}`;
  }

  // --- helpers -----------------------------------------------------------

  private static solutionsTable(report: SolvedReport): string[] {
    const rows = report.solutions.map((s, i) => [
      String(i + 1),
      String(s.stats.frame),
      `${(s.stats.frame / TextFormatter.FPS).toFixed(2)}s`,
      String(s.stats.steps),
      String(s.stats.walks),
      String(s.stats.jumps),
      String(s.stats.drops),
      String(s.stats.score),
      String(s.stats.attempts),
    ]);
    return TextFormatter.table(TextFormatter.SOLUTION_HEADERS, rows);
  }

  // Indented issues, truncated so one bad glyph repeated everywhere
  // doesn't scroll the useful ones away.
  private static issueList(issues: readonly ValidationIssue[]): string[] {
    const max = TextFormatter.MAX_LISTED_ISSUES;
    const shown = issues.slice(0, max).map((i) => `  ${TextFormatter.issueLine(i)}`);
    const hidden = issues.length - max;
    return hidden > 0 ? [...shown, `  ... and ${hidden} more`] : shown;
  }

  // One sweep line: the id padded to `idWidth`, the result padded to 8, and
  // the numbers right-aligned under their headers.
  private static sweepLine(cells: string[], idWidth: number): string {
    const headers = TextFormatter.SWEEP_HEADERS;
    const [id, result, ...numbers] = cells;
    const widths = headers.slice(2).map((h) => h.length);
    return [
      id.padEnd(Math.max(idWidth, headers[0].length)),
      result.padEnd(8),
      ...numbers.map((n, i) => n.padStart(widths[i])),
    ].join('  ');
  }

  // Right-aligned columns under headers, each as wide as its widest cell.
  private static table(headers: string[], rows: string[][]): string[] {
    const widths = headers.map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)));
    const line = (cells: string[]) => cells.map((cell, col) => cell.padStart(widths[col])).join('  ');
    return [line(headers), ...rows.map(line)];
  }

  // Wall-clock time: milliseconds under a second, else seconds.
  private static duration(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  private static plural(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
  }
}
