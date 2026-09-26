import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { FailureReason } from './FailureReason.ts';
import { GoalKind } from './GoalKind.ts';
import { LevelTester } from './LevelTester.ts';
import { PlannerKind } from './PlannerKind.ts';
import type { LevelTestFailure, LevelTestSuccess } from './LevelTestResult.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const tester = LevelTester.create(jsAdapter);

// Disconnected platforms with a void wider than the 8-cell jump reach.
const UNSOLVABLE = [
  '##........##',
  '#P........E#',
  '##........##',
  '............',
  '............',
].join('\n');

Deno.test('test: trivial walk-to-exit succeeds in 1 attempt', async () => {
  const r = await tester.test(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND, null) as LevelTestSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solution.stats.attempts, 1);
  assert(r.solution.stats.steps > 0);
});

Deno.test('test: # pickup-required: 0 → exit-direct level wins', async () => {
  const r = await tester.test(Level.parse('# pickup-required: 0\n#######\n#P.o.E#\n#######'), DEFAULT_LEGEND, null);
  assertEquals(r.ok, true);
});

Deno.test('test: pickup-required all → solution collects coin first', async () => {
  const r = await tester.test(Level.parse('#######\n#P.o.E#\n#######'), DEFAULT_LEGEND, null) as LevelTestSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solution.stats.score, 1);
});

Deno.test('test: unreachable exit → ok: false, attempts === 0', async () => {
  const r = await tester.test(Level.parse(UNSOLVABLE), DEFAULT_LEGEND, null) as LevelTestFailure;
  assertEquals(r.ok, false);
  assertEquals(r.attempts, 0);
  assert(r.lastPlan.unreachable.some((u) => u.kind === GoalKind.Exit));
});

Deno.test('test: solution carries enough info for the dialog UI', async () => {
  const r = await tester.test(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND, null) as LevelTestSuccess;
  assert(r.solution.plan);
  assert(Array.isArray(r.solution.plan.trace));
  assert(Array.isArray(r.solution.recording));
  assert(r.solution.stats);
  assert(typeof r.solution.stats.frame === 'number');
  assertEquals(r.solution, r.solutions[0]);
});

Deno.test('test: onProgress callback fires at least once', async () => {
  const progressCalls: { elapsed: number; total: number }[] = [];
  const r = await tester.test(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND, null, {
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assertEquals(r.ok, true);
  assert(progressCalls.length >= 1, 'onProgress should fire at least once');
  assert(progressCalls[0].total === 5000, 'default budget is 5000ms');
});

Deno.test('test: maxRuntimeMs option overrides the default budget', async () => {
  const progressCalls: { elapsed: number; total: number }[] = [];
  const r = await tester.test(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND, null, {
    maxRuntimeMs: 10000,
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assertEquals(r.ok, true);
  assert(progressCalls.every((p) => p.total === 10000));
});

Deno.test('test: signal.abort() interrupts the search', async () => {
  // With a pre-aborted signal the run stops at its first budget check.
  const ac = new AbortController();
  ac.abort();
  const r = await tester.test(Level.parse(UNSOLVABLE), DEFAULT_LEGEND, null, { signal: ac.signal });
  assertEquals(r.ok, false);
});

Deno.test('test: a solvable level aborted before the first check reports timeout-during-plan', async () => {
  const ac = new AbortController();
  ac.abort();
  const r = await tester.test(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND, null, { signal: ac.signal }) as LevelTestFailure;
  assertEquals(r.ok, false);
  assertEquals(r.reason, FailureReason.TimeoutDuringPlan);
  assertEquals(r.attempts, 0);
});

Deno.test('test: the bucket strategy can collect several distinct solutions', async () => {
  const bucket = LevelTester.create(jsAdapter, PlannerKind.Bucket);
  // A wall to hop: several jumps and release frames get over it.
  const text = '..........\n..........\n#P.#....E#\n##########';
  const r = await bucket.test(Level.parse(text), DEFAULT_LEGEND, null, { maxRuntimeMs: 60_000 }) as LevelTestSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solutions.length, LevelTester.MAX_SOLUTIONS);
  const keys = new Set(r.solutions.map((s) => s.plan.recordingKey()));
  assertEquals(keys.size, r.solutions.length);
  // Fewest frames first.
  for (let i = 1; i < r.solutions.length; i++) {
    assert(r.solutions[i - 1].stats.frame <= r.solutions[i].stats.frame);
  }
});

Deno.test('test: the default strategy collects several distinct solutions on a real level', async () => {
  const level = Level.parse(Deno.readTextFileSync('content/data/levels/tutorial.txt'));
  const r = await tester.test(level, DEFAULT_LEGEND, null, { maxRuntimeMs: 60_000 }) as LevelTestSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solutions.length, LevelTester.MAX_SOLUTIONS);
  // Every solution takes a different route and presses different keys.
  assertEquals(new Set(r.solutions.map((s) => s.plan.routeKey())).size, r.solutions.length);
  assertEquals(new Set(r.solutions.map((s) => s.plan.recordingKey())).size, r.solutions.length);
  for (let i = 1; i < r.solutions.length; i++) {
    assert(r.solutions[i - 1].stats.frame <= r.solutions[i].stats.frame);
  }
});
