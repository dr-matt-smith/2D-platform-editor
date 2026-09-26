import { assert, assertEquals, assertMatch } from '@std/assert';
import type { LevelTestFailure, Solution } from '@2d-platform/agent';
import { AgentDialogMarkup } from './AgentDialogMarkup.ts';

// Just the fields the markup reads.
const solution = (steps: number, attempts = 1): Solution => ({
  stats: { steps, jumps: 1, score: 0, attempts },
  plan: { trace: [{ frameRange: [0, 12], why: 'walk <right>' }] },
  recording: [],
} as unknown as Solution);

const failure = (over: Partial<Record<'unreachable' | 'lastSim', unknown>> = {}): LevelTestFailure => ({
  ok: false,
  lastPlan: { unreachable: over.unreachable ?? [] },
  lastSim: over.lastSim ?? null,
  attempts: 1,
} as unknown as LevelTestFailure);

Deno.test('searching shows the budget in seconds', () => {
  const html = AgentDialogMarkup.searching(5000);
  assertMatch(html, /<output class="countdown">5\.0s<\/output>/);
  assertMatch(html, /max="5000"/);
});

Deno.test('success lists every solution; only the focused one has Demo', () => {
  const html = AgentDialogMarkup.success([solution(3), solution(1, 3)], 1);
  assertMatch(html, /✓ Level completable — 2 solutions/);
  assertEquals(html.match(/data-act="demo"/g)?.length, 1);
  assertMatch(html, /solution-row focused" data-act="focus-1"/);
  assertMatch(html, /1 step<\/span>/);
  assertMatch(html, /2 replans/);
  assertMatch(html, /walk &lt;right&gt;/); // trace text is escaped
});

Deno.test('minimised shows the focused solution only', () => {
  const html = AgentDialogMarkup.minimised([solution(3)], 0);
  assertMatch(html, /✓ Completable/);
  assertMatch(html, /S1/);
  assertMatch(html, /3 steps/);
});

Deno.test('failure offers only the longer budgets', () => {
  const at5 = AgentDialogMarkup.failure(failure(), 5000);
  assertMatch(at5, /No solution within 5s/);
  assertEquals(at5.match(/data-act="try\d+"/g), ['data-act="try10"', 'data-act="try15"', 'data-act="try20"']);
  const at15 = AgentDialogMarkup.failure(failure(), 15000);
  assertEquals(at15.match(/data-act="try\d+"/g), ['data-act="try20"']);
  assert(!AgentDialogMarkup.failure(failure(), 20000).includes('escalation-row'));
});

Deno.test('failureReason explains an unreachable exit, a death or a timeout', () => {
  assertMatch(AgentDialogMarkup.failureReason(failure({ unreachable: [{ kind: 'exit' }] })), /Exit unreachable/);
  assertMatch(
    AgentDialogMarkup.failureReason(failure({ lastSim: { outcome: 'dead', pos: { x: 10.4, y: 20.6 }, frame: 7 } })),
    /dead<\/code> at world \(10, 21\) on frame 7/,
  );
  assertMatch(AgentDialogMarkup.failureReason(failure({ lastSim: { outcome: 'timeout', frame: 99 } })), /timed out at frame 99/);
  assertEquals(AgentDialogMarkup.failureReason(failure()), 'No solution found within budget.');
});
