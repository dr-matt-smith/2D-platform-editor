import { assertEquals } from '@std/assert';
import { ActionKind } from './ActionKind.ts';
import { Direction } from './Direction.ts';
import { PlanBuilder } from './PlanBuilder.ts';

Deno.test('PlanBuilder starts at frame 1 with nothing held', () => {
  const b = new PlanBuilder();
  assertEquals(b.currentFrame, 1);
  assertEquals(b.heldDirection, null);
});

Deno.test('holdDirection presses once, and swaps direction with a release + press', () => {
  const b = new PlanBuilder();
  b.holdDirection(Direction.Right);
  b.holdDirection(Direction.Right); // already held: no new events
  b.addStep(ActionKind.Walk, { r: 1, c: 2 }, 'walk', 5, 'e1');
  b.holdDirection(Direction.Left);
  const plan = b.build(null, [], []);
  assertEquals(plan.recording, [
    { frame: 1, key: 'right', down: true },
    { frame: 6, key: 'right', down: false },
    { frame: 6, key: 'left', down: true },
  ]);
});

Deno.test('tapJump taps space for one frame; releaseDirectionAfter only inside the step', () => {
  const b = new PlanBuilder();
  b.holdDirection(Direction.Right);
  b.tapJump();
  b.releaseDirectionAfter(50, 42); // beyond the step: ignored
  assertEquals(b.heldDirection, Direction.Right);
  b.releaseDirectionAfter(12, 42);
  assertEquals(b.heldDirection, null);
  b.releaseDirectionAfter(20, 42); // nothing held: ignored
  assertEquals(b.build(null, [], []).recording, [
    { frame: 1, key: 'right', down: true },
    { frame: 1, key: 'space', down: true },
    { frame: 2, key: 'space', down: false },
    { frame: 13, key: 'right', down: false },
  ]);
});

Deno.test('addStep writes the trace, moves the clock and counts by kind', () => {
  const b = new PlanBuilder();
  b.addStep(ActionKind.Walk, { r: 1, c: 2 }, 'a', 5, 'e1');
  b.addStep(ActionKind.Jump, { r: 1, c: 5 }, 'b', 40, 'e2');
  b.addStep(ActionKind.DropRelease, { r: 3, c: 6 }, 'c', 20, 'e3');
  b.addStep(ActionKind.RunOff, { r: 4, c: 9 }, 'd', 30, 'e4');
  assertEquals(b.currentFrame, 96);
  const plan = b.build({ start: { r: 1, c: 1 }, pickupCells: [], exitCells: [], width: 9, height: 5 }, ['4,9'], []);
  assertEquals(plan.stats, { steps: 4, jumps: 1, walks: 2, drops: 1 });
  assertEquals(plan.trace[1], {
    kind: ActionKind.Jump,
    target: { r: 1, c: 5 },
    why: 'b',
    frameRange: [6, 46],
    edgeId: 'e2',
  });
  assertEquals(plan.goals, ['4,9']);
});

Deno.test('releaseHeldDirection lets go at the current frame', () => {
  const b = new PlanBuilder();
  b.holdDirection(Direction.Left);
  b.addStep(ActionKind.Walk, { r: 1, c: 1 }, 'a', 5, 'e1');
  b.releaseHeldDirection();
  b.releaseHeldDirection(); // nothing held any more
  assertEquals(b.build(null, [], []).recording, [
    { frame: 1, key: 'left', down: true },
    { frame: 6, key: 'left', down: false },
  ]);
});
