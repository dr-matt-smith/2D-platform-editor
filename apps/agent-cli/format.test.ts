import { assertEquals, assertStringIncludes } from '@std/assert';
import type { ValidationIssue } from '@2d-platform/level-format';
import {
  formatJson,
  formatReport,
  formatSweepHeader,
  formatSweepJson,
  formatSweepRow,
  formatSweepSummary,
  MAX_LISTED_ISSUES,
} from './format.ts';
import type { InvalidReport, LevelInfo, SolvedReport, UnsolvedReport } from './solve.ts';

const LEVEL: LevelInfo = {
  id: 'tutorial',
  name: 'tutorial',
  path: 'content/data/levels/tutorial.txt',
  tileset: 'Dirt_Platformer_Tiles',
  width: 24,
  height: 10,
};

const SOLVED: SolvedReport = {
  status: 'solved',
  level: LEVEL,
  warnings: [],
  budgetMs: 5000,
  elapsedMs: 59,
  solutions: [
    {
      stats: { steps: 8, walks: 5, jumps: 3, drops: 0, attempts: 1, frame: 83, score: 4 },
      recording: [{ frame: 1, key: 'right', down: true }],
      trace: [],
      unreachable: [],
    },
  ],
};

const UNSOLVED: UnsolvedReport = {
  status: 'unsolved',
  level: { ...LEVEL, id: 'fred', name: 'fred', path: 'content/data/levels/fred.txt' },
  warnings: [],
  budgetMs: 5000,
  elapsedMs: 1240,
  attempts: 0,
  reasons: ['Exit at line 11, col 2 is unreachable from the spawn.'],
  lastSim: null,
  unreachable: [{ r: 8, c: 1, kind: 'exit' }],
};

const issue = (message: string): ValidationIssue => ({ line: 3, col: 5, severity: 'error', message });

Deno.test('a solved report shows the level, the verdict and a stats row per solution', () => {
  const lines = formatReport(SOLVED).split('\n');
  assertEquals(lines[0], 'Level:    tutorial  (content/data/levels/tutorial.txt)');
  assertEquals(lines[1], 'Tileset:  Dirt_Platformer_Tiles, 24x10');
  assertEquals(lines[2], 'Solvable: yes, 1 distinct solution found in 59ms (budget 5.0s)');
  assertEquals(lines[4], '#  frames  game time  steps  walks  jumps  drops  score  attempt');
  assertEquals(lines[5], '1      83      1.38s      8      5      3      0      4        1');
});

Deno.test('an unsolved report lists the reasons', () => {
  const text = formatReport(UNSOLVED);
  assertStringIncludes(text, 'Solvable: no solution found in 1.2s (budget 5.0s, 0 attempts)');
  assertStringIncludes(text, 'Reasons:\n  - Exit at line 11, col 2 is unreachable from the spawn.');
});

Deno.test('an invalid report lists the problems, truncating long lists', () => {
  const errors = Array.from({ length: MAX_LISTED_ISSUES + 3 }, (_, i) => issue(`problem ${i}`));
  const report: InvalidReport = { status: 'invalid', level: LEVEL, warnings: [], errors };
  const text = formatReport(report);
  assertStringIncludes(text, 'Solvable: no, the level is invalid\nProblems:\n');
  assertStringIncludes(text, '  line 3, col 5: error: problem 0\n');
  assertStringIncludes(text, '  ... and 3 more');
});

Deno.test('warnings appear before the verdict', () => {
  const warn: ValidationIssue = { line: 1, col: 1, severity: 'warn', message: 'no exit in level' };
  const text = formatReport({ ...SOLVED, warnings: [warn] });
  assertStringIncludes(text, 'Warnings:\n  line 1, col 1: warn: no exit in level\nSolvable: yes');
});

Deno.test('sweep rows line up under the header', () => {
  const header = formatSweepHeader(8);
  const solved = formatSweepRow(SOLVED, 8);
  const unsolved = formatSweepRow(UNSOLVED, 8);
  assertEquals(header, 'level     result    solutions  best frames  jumps  time');
  assertEquals(solved, 'tutorial  solved            1           83      3  59ms');
  assertEquals(unsolved, 'fred      UNSOLVED          -            -      -  1.2s');
});

Deno.test('the sweep summary names the failures', () => {
  const summary = { total: 6, solved: 5, unsolved: 1, invalid: 0, elapsedMs: 3400, failed: ['fred'] };
  assertEquals(formatSweepSummary(summary), 'Summary: 5/6 solved, 1 unsolved in 3.4s (failed: fred)');
  const allGood = { total: 2, solved: 2, unsolved: 0, invalid: 0, elapsedMs: 80, failed: [] };
  assertEquals(formatSweepSummary(allGood), 'Summary: 2/2 solved in 80ms');
});

Deno.test('JSON output round-trips the report, recordings included', () => {
  assertEquals(JSON.parse(formatJson(SOLVED)), SOLVED);
  const summary = { total: 1, solved: 1, unsolved: 0, invalid: 0, elapsedMs: 59, failed: [] };
  assertEquals(JSON.parse(formatSweepJson(summary, [SOLVED])), { summary, levels: [SOLVED] });
});
