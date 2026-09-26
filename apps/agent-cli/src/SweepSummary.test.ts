import { assert, assertEquals } from '@std/assert';
import { ReportStatus } from './ReportStatus.ts';
import { SweepSummary } from './SweepSummary.ts';
import type { LevelReport, SolvedReport } from './LevelReport.ts';

const level = (id: string) => ({ id, name: id, path: `${id}.txt`, tileset: 't', width: 1, height: 1 });

Deno.test('SweepSummary.of counts outcomes and names the failures', () => {
  const reports: LevelReport[] = [
    { status: ReportStatus.Solved, level: level('a'), warnings: [], budgetMs: 5000, elapsedMs: 100, solutions: [] },
    {
      status: ReportStatus.Unsolved,
      level: level('b'),
      warnings: [],
      budgetMs: 5000,
      elapsedMs: 250,
      attempts: 2,
      reasons: [],
      lastSim: null,
      unreachable: [],
    },
    { status: ReportStatus.Invalid, level: level('c'), warnings: [], errors: [] },
  ];
  const summary = SweepSummary.of(reports);
  assertEquals({ ...summary }, {
    total: 3,
    solved: 1,
    unsolved: 1,
    invalid: 1,
    elapsedMs: 350,
    failed: ['b', 'c'],
  });
  assert(!summary.allSolved);
});

Deno.test('allSolved is true only when every level was solved', () => {
  const solved: SolvedReport = {
    status: ReportStatus.Solved,
    level: level('a'),
    warnings: [],
    budgetMs: 1,
    elapsedMs: 1,
    solutions: [],
  };
  assert(SweepSummary.of([solved, solved]).allSolved);
  assert(SweepSummary.of([]).allSolved, 'an empty sweep has nothing unsolved');
});

Deno.test('a summary serialises to exactly its totals, in order', () => {
  const totals = { total: 2, solved: 2, unsolved: 0, invalid: 0, elapsedMs: 80, failed: [] };
  assertEquals(JSON.stringify(new SweepSummary(totals)), JSON.stringify(totals));
});
