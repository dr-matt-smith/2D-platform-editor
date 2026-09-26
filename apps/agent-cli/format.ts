// Turn reports into text for people or JSON for tools. Pure functions:
// every formatter returns a string and main.ts decides where it goes.
import type { ValidationIssue } from '@2d-platform/level-format';
import type { LevelReport, SolvedReport, SweepSummary } from './solve.ts';

/** The engine steps at a fixed 60 frames per simulated second. */
const FPS = 60;

/** Longest problem list shown in text output (JSON always has them all). */
export const MAX_LISTED_ISSUES = 10;

// --- single level ------------------------------------------------------

export function formatReport(report: LevelReport): string {
  const { level } = report;
  const lines = [
    `Level:    ${level.name}  (${level.path})`,
    `Tileset:  ${level.tileset}, ${level.width}x${level.height}`,
  ];
  if (report.warnings.length > 0) {
    lines.push('Warnings:', ...issueList(report.warnings));
  }

  if (report.status === 'invalid') {
    lines.push('Solvable: no, the level is invalid', 'Problems:');
    lines.push(...issueList(report.errors));
  } else if (report.status === 'unsolved') {
    lines.push(
      `Solvable: no solution found in ${duration(report.elapsedMs)} ` +
        `(budget ${duration(report.budgetMs)}, ${plural(report.attempts, 'attempt')})`,
      'Reasons:',
      ...report.reasons.map((r) => `  - ${r}`),
    );
  } else {
    const count = plural(report.solutions.length, 'distinct solution');
    lines.push(
      `Solvable: yes, ${count} found in ${duration(report.elapsedMs)} (budget ${duration(report.budgetMs)})`,
      '',
      ...solutionsTable(report),
    );
  }
  return lines.join('\n');
}

function solutionsTable(report: SolvedReport): string[] {
  const headers = ['#', 'frames', 'game time', 'steps', 'walks', 'jumps', 'drops', 'score', 'attempt'];
  const rows = report.solutions.map((s, i) => [
    String(i + 1),
    String(s.stats.frame),
    `${(s.stats.frame / FPS).toFixed(2)}s`,
    String(s.stats.steps),
    String(s.stats.walks),
    String(s.stats.jumps),
    String(s.stats.drops),
    String(s.stats.score),
    String(s.stats.attempts),
  ]);
  return table(headers, rows);
}

export function formatIssue(issue: ValidationIssue): string {
  return `line ${issue.line}, col ${issue.col}: ${issue.severity}: ${issue.message}`;
}

// Indented issues, truncated so one bad glyph repeated everywhere
// doesn't scroll the useful ones away.
function issueList(issues: readonly ValidationIssue[]): string[] {
  const shown = issues.slice(0, MAX_LISTED_ISSUES).map((i) => `  ${formatIssue(i)}`);
  const hidden = issues.length - MAX_LISTED_ISSUES;
  return hidden > 0 ? [...shown, `  ... and ${hidden} more`] : shown;
}

// --- --all sweep -------------------------------------------------------

const SWEEP_HEADERS = ['level', 'result', 'solutions', 'best frames', 'jumps', 'time'];

/**
 * The sweep table, one piece at a time so main.ts can print each row as
 * its level finishes. `idWidth` is the widest level id, known up front.
 */
export function formatSweepHeader(idWidth: number): string {
  return sweepLine(SWEEP_HEADERS, idWidth);
}

export function formatSweepRow(report: LevelReport, idWidth: number): string {
  const id = report.level.id ?? report.level.name;
  if (report.status === 'solved') {
    const best = report.solutions[0].stats;
    const numbers = [report.solutions.length, best.frame, best.jumps].map(String);
    return sweepLine([id, 'solved', ...numbers, duration(report.elapsedMs)], idWidth);
  }
  const time = report.status === 'unsolved' ? duration(report.elapsedMs) : '-';
  return sweepLine([id, report.status.toUpperCase(), '-', '-', '-', time], idWidth);
}

export function formatSweepSummary(summary: SweepSummary): string {
  const parts = [`${summary.solved}/${summary.total} solved`];
  if (summary.unsolved > 0) parts.push(`${summary.unsolved} unsolved`);
  if (summary.invalid > 0) parts.push(`${summary.invalid} invalid`);
  const failed = summary.failed.length > 0 ? ` (failed: ${summary.failed.join(', ')})` : '';
  return `Summary: ${parts.join(', ')} in ${duration(summary.elapsedMs)}${failed}`;
}

function sweepLine(cells: string[], idWidth: number): string {
  const [id, result, ...numbers] = cells;
  const widths = SWEEP_HEADERS.slice(2).map((h) => h.length);
  return [
    id.padEnd(Math.max(idWidth, SWEEP_HEADERS[0].length)),
    result.padEnd(8),
    ...numbers.map((n, i) => n.padStart(widths[i])),
  ].join('  ');
}

// --- JSON --------------------------------------------------------------

export function formatJson(report: LevelReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatSweepJson(summary: SweepSummary, reports: readonly LevelReport[]): string {
  return JSON.stringify({ summary, levels: reports }, null, 2);
}

// --- helpers -----------------------------------------------------------

/** Right-aligned columns under headers, each as wide as its widest cell. */
function table(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, col) => Math.max(h.length, ...rows.map((row) => row[col].length)));
  const line = (cells: string[]) => cells.map((cell, col) => cell.padStart(widths[col])).join('  ');
  return [line(headers), ...rows.map(line)];
}

/** Wall-clock time: milliseconds under a second, else seconds. */
function duration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
