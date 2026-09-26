import { assertEquals, assertStrictEquals } from '@std/assert';
import { ActionKind } from './ActionKind.ts';
import { GoalKind } from './GoalKind.ts';
import { Plan } from './Plan.ts';
import { SimOutcome } from './SimOutcome.ts';
import { Solution } from './Solution.ts';

Deno.test('Solution.fromWin combines the plan\'s counts with the winning replay', () => {
  const plan = new Plan({
    trace: [{ kind: ActionKind.Walk, target: { r: 1, c: 3 }, why: 'walk', frameRange: [1, 11], edgeId: 'e' }],
    recording: [{ frame: 1, key: 'right', down: true }],
    stats: { steps: 1, jumps: 0, walks: 1, drops: 0 },
    graph: null,
    goals: ['1,3'],
    unreachable: [{ r: 1, c: 9, kind: GoalKind.Pickup }],
  });
  const s = Solution.fromWin(plan, { outcome: SimOutcome.Won, frame: 9, score: 2, pos: { x: 60, y: 20 } }, 3);
  assertStrictEquals(s.plan, plan);
  assertStrictEquals(s.recording, plan.recording);
  assertStrictEquals(s.unreachable, plan.unreachable);
  // Key order is part of the CLI's JSON output.
  assertEquals(Object.keys(s.stats), ['steps', 'walks', 'jumps', 'drops', 'attempts', 'frame', 'score']);
  assertEquals(s.stats, { steps: 1, walks: 1, jumps: 0, drops: 0, attempts: 3, frame: 9, score: 2 });
});
