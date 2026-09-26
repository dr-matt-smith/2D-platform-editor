import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { DEFAULT_LEGEND, parse } from '@2d-platform/level-format';
import { prepareLevel, resolveLevel } from './levelSource.ts';
import type { PreparedLevel } from './levelSource.ts';
import { solveLevel, summarise } from './solve.ts';
import type { LevelReport } from './solve.ts';

const HERE = import.meta.dirname ?? '.';
const BUNDLED = `${HERE}/../../content/data`;
const OPTIONS = { budgetMs: 5000 };

// An in-memory level with the default legend: no disk access needed.
function inline(text: string): PreparedLevel {
  return {
    id: null,
    path: 'inline.txt',
    text,
    parsed: parse(text),
    legend: DEFAULT_LEGEND,
    tilesetWarning: null,
  };
}

Deno.test('solves a small inline level', async () => {
  const report = await solveLevel(inline('# name: corridor\n#######\n#P...E#\n#######'), OPTIONS);
  assert(report.status === 'solved', `expected solved, got ${report.status}`);
  assertEquals(report.level.name, 'corridor');
  assert(report.solutions.length >= 1);
  const [best] = report.solutions;
  assert(best.stats.frame > 0);
  assert(best.recording.length > 0, 'a solution carries a replayable recording');
  assertEquals(best.trace.length, best.stats.steps);
});

Deno.test('solves the bundled tutorial level', async () => {
  const level = await prepareLevel(await resolveLevel('tutorial', BUNDLED), BUNDLED);
  const report = await solveLevel(level, OPTIONS);
  assertEquals(report.status, 'solved');
  assertEquals(report.level.id, 'tutorial');
});

Deno.test('an enclosed exit is reported as unreachable', async () => {
  const report = await solveLevel(inline('#########\n#P..#.E.#\n#########'), OPTIONS);
  assert(report.status === 'unsolved', `expected unsolved, got ${report.status}`);
  assertEquals(report.unreachable.map((u) => u.kind), ['exit']);
  assertStringIncludes(report.reasons[0], 'Exit at line 2, col 7 is unreachable');
});

Deno.test('an invalid level is not handed to the agent', async () => {
  const report = await solveLevel(inline('#####\n#..E#\n#####'), OPTIONS);
  assert(report.status === 'invalid', `expected invalid, got ${report.status}`);
  assertStringIncludes(report.errors[0].message, 'no player spawn');
});

Deno.test('warnings are kept, including an unknown tileset', async () => {
  const level = { ...inline('#####\n#P..#\n#####'), tilesetWarning: "unknown tileset 'X', using default" };
  const report = await solveLevel(level, OPTIONS);
  const messages = report.warnings.map((w) => w.message);
  assertEquals(messages[0], "unknown tileset 'X', using default");
  assert(messages.includes('no exit in level'), messages.join('; '));
});

Deno.test('the file name stands in for a missing # name', async () => {
  const level = { ...inline('#####\n#..E#\n#####'), path: 'levels/untitled.txt' };
  const report = await solveLevel(level, OPTIONS);
  assertEquals(report.level.name, 'untitled');
});

Deno.test('summarise counts outcomes and names the failures', () => {
  const level = (id: string) => ({ id, name: id, path: `${id}.txt`, tileset: 't', width: 1, height: 1 });
  const reports: LevelReport[] = [
    { status: 'solved', level: level('a'), warnings: [], budgetMs: 5000, elapsedMs: 100, solutions: [] },
    {
      status: 'unsolved',
      level: level('b'),
      warnings: [],
      budgetMs: 5000,
      elapsedMs: 250,
      attempts: 2,
      reasons: [],
      lastSim: null,
      unreachable: [],
    },
    { status: 'invalid', level: level('c'), warnings: [], errors: [] },
  ];
  assertEquals(summarise(reports), {
    total: 3,
    solved: 1,
    unsolved: 1,
    invalid: 1,
    elapsedMs: 350,
    failed: ['b', 'c'],
  });
});
