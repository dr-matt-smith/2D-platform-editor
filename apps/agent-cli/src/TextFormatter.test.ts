import { assertEquals, assertStringIncludes } from '@std/assert';
import { Severity } from '@2d-platform/level-format';
import type { ValidationIssue } from '@2d-platform/level-format';
import { ReportStatus } from './ReportStatus.ts';
import { SweepSummary } from './SweepSummary.ts';
import { TextFormatter } from './TextFormatter.ts';
import { LEVEL, SOLVED, UNSOLVED } from './testReports.ts';
import type { InvalidReport } from './LevelReport.ts';

const text = new TextFormatter();
const issue = (message: string): ValidationIssue => ({ line: 3, col: 5, severity: Severity.Error, message });

Deno.test('a solved report shows the level, the verdict and a stats row per solution', () => {
  const lines = text.report(SOLVED).split('\n');
  assertEquals(lines[0], 'Level:    tutorial  (content/data/levels/tutorial.txt)');
  assertEquals(lines[1], 'Tileset:  Dirt_Platformer_Tiles, 24x10');
  assertEquals(lines[2], 'Solvable: yes, 1 distinct solution found in 59ms (budget 5.0s)');
  assertEquals(lines[4], '#  frames  game time  steps  walks  jumps  drops  score  attempt');
  assertEquals(lines[5], '1      83      1.38s      8      5      3      0      4        1');
});

Deno.test('an unsolved report lists the reasons', () => {
  const report = text.report(UNSOLVED);
  assertStringIncludes(report, 'Solvable: no solution found in 1.2s (budget 5.0s, 0 attempts)');
  assertStringIncludes(report, 'Reasons:\n  - Exit at line 11, col 2 is unreachable from the spawn.');
});

Deno.test('an invalid report lists the problems, truncating long lists', () => {
  const errors = Array.from({ length: TextFormatter.MAX_LISTED_ISSUES + 3 }, (_, i) => issue(`problem ${i}`));
  const invalid: InvalidReport = { status: ReportStatus.Invalid, level: LEVEL, warnings: [], errors };
  const report = text.report(invalid);
  assertStringIncludes(report, 'Solvable: no, the level is invalid\nProblems:\n');
  assertStringIncludes(report, '  line 3, col 5: error: problem 0\n');
  assertStringIncludes(report, '  ... and 3 more');
});

Deno.test('warnings appear before the verdict', () => {
  const warn: ValidationIssue = { line: 1, col: 1, severity: Severity.Warn, message: 'no exit in level' };
  const report = text.report({ ...SOLVED, warnings: [warn] });
  assertStringIncludes(report, 'Warnings:\n  line 1, col 1: warn: no exit in level\nSolvable: yes');
});

Deno.test('issueLine gives the position, severity and message', () => {
  assertEquals(TextFormatter.issueLine(issue('bad glyph')), 'line 3, col 5: error: bad glyph');
});

Deno.test('sweep rows line up under the header', () => {
  assertEquals(text.sweepHeader(8), 'level     result    solutions  best frames  jumps  time');
  assertEquals(text.sweepRow(SOLVED, 8), 'tutorial  solved            1           83      3  59ms');
  assertEquals(text.sweepRow(UNSOLVED, 8), 'fred      UNSOLVED          -            -      -  1.2s');
});

Deno.test('the sweep summary names the failures', () => {
  const summary = new SweepSummary({ total: 6, solved: 5, unsolved: 1, invalid: 0, elapsedMs: 3400, failed: ['fred'] });
  assertEquals(text.summaryLine(summary), 'Summary: 5/6 solved, 1 unsolved in 3.4s (failed: fred)');
  const allGood = new SweepSummary({ total: 2, solved: 2, unsolved: 0, invalid: 0, elapsedMs: 80, failed: [] });
  assertEquals(text.summaryLine(allGood), 'Summary: 2/2 solved in 80ms');
});

Deno.test('sweepSummary sets the summary line off with a blank line', () => {
  const summary = SweepSummary.of([SOLVED]);
  assertEquals(text.sweepSummary(summary), `\n${text.summaryLine(summary)}`);
});
