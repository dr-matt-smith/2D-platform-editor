import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { FailureReason, SimOutcome } from '@2d-platform/agent';
import type { LevelTestFailure } from '@2d-platform/agent';
import { ContentStore } from './ContentStore.ts';
import { LevelSolver } from './LevelSolver.ts';
import { ReportStatus } from './ReportStatus.ts';
import type { PreparedLevel } from './PreparedLevel.ts';

const HERE = import.meta.dirname ?? '.';
const BUNDLED = `${HERE}/../../../content/data`;
const BUDGET_MS = 5000;
const solver = new LevelSolver();

// An in-memory level with the default legend: no disk access needed.
function inline(text: string): PreparedLevel {
  return {
    id: null,
    path: 'inline.txt',
    text,
    parsed: Level.parse(text),
    legend: Legend.DEFAULT,
    tilesetWarning: null,
  };
}

Deno.test('solves a small inline level', async () => {
  const report = await solver.solve(inline('# name: corridor\n#######\n#P...E#\n#######'), BUDGET_MS);
  assert(report.status === ReportStatus.Solved, `expected solved, got ${report.status}`);
  assertEquals(report.level.name, 'corridor');
  assert(report.solutions.length >= 1);
  const [best] = report.solutions;
  assert(best.stats.frame > 0);
  assert(best.recording.length > 0, 'a solution carries a replayable recording');
  assertEquals(best.trace.length, best.stats.steps);
});

Deno.test('solves the bundled tutorial level', async () => {
  const store = new ContentStore(BUNDLED);
  const level = await store.prepare(await store.resolve('tutorial'));
  const report = await solver.solve(level, BUDGET_MS);
  assertEquals(report.status, ReportStatus.Solved);
  assertEquals(report.level.id, 'tutorial');
});

Deno.test('an enclosed exit is reported as unreachable', async () => {
  const report = await solver.solve(inline('#########\n#P..#.E.#\n#########'), BUDGET_MS);
  assert(report.status === ReportStatus.Unsolved, `expected unsolved, got ${report.status}`);
  assertEquals(report.unreachable.map((u) => u.kind), ['exit']);
  assertStringIncludes(report.reasons[0], 'Exit at line 2, col 7 is unreachable');
});

Deno.test('an invalid level is not handed to the agent', async () => {
  const report = await solver.solve(inline('#####\n#..E#\n#####'), BUDGET_MS);
  assert(report.status === ReportStatus.Invalid, `expected invalid, got ${report.status}`);
  assertStringIncludes(report.errors[0].message, 'no player spawn');
});

Deno.test('warnings are kept, including an unknown tileset', async () => {
  const level = { ...inline('#####\n#P..#\n#####'), tilesetWarning: "unknown tileset 'X', using default" };
  const report = await solver.solve(level, BUDGET_MS);
  const messages = report.warnings.map((w) => w.message);
  assertEquals(messages[0], "unknown tileset 'X', using default");
  assert(messages.includes('no exit in level'), messages.join('; '));
});

Deno.test('the file name stands in for a missing # name', async () => {
  const level = { ...inline('#####\n#..E#\n#####'), path: 'levels/untitled.txt' };
  const report = await solver.solve(level, BUDGET_MS);
  assertEquals(report.level.name, 'untitled');
});

Deno.test('describeFailure explains a timeout and a death, or falls back to a generic reason', () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const failure = (extra: Partial<LevelTestFailure>): LevelTestFailure =>
    ({ ok: false, attempts: 1, lastSim: null, lastPlan: { unreachable: [] }, ...extra }) as unknown as LevelTestFailure;

  assertEquals(LevelSolver.describeFailure(failure({}), parsed), ['No solution found within the budget.']);
  assertStringIncludes(
    LevelSolver.describeFailure(failure({ reason: FailureReason.TimeoutDuringPlan }), parsed)[0],
    'try a larger --budget',
  );
  const died = failure({ lastSim: { outcome: SimOutcome.Dead, frame: 40, score: 0, pos: { x: 10.4, y: 20.6 } } });
  assertEquals(LevelSolver.describeFailure(died, parsed), [
    'Last simulation: player died at world (10, 21) on frame 40.',
  ]);
});
