import { assert, assertEquals, assertStrictEquals } from '@std/assert';
import { ActionCatalog } from './ActionCatalog.ts';
import { ActionKind } from './ActionKind.ts';
import { Direction } from './Direction.ts';
import { DropReleaseAction } from './DropReleaseAction.ts';
import { JumpAction } from './JumpAction.ts';
import { RunOffAction } from './RunOffAction.ts';
import { WalkAction } from './WalkAction.ts';

// --- constants derived from physics ----------------------------------

Deno.test('constants: WalkAction.FRAMES_PER_CELL = 5 (TILE 20 / SPEED 240 = 1/12s = 5 frames @ 60fps)', () => {
  assertEquals(WalkAction.FRAMES_PER_CELL, 5);
});

Deno.test('constants: JumpAction.ARC_FRAMES = 42 (2 * JUMP_FORCE / GRAVITY * 60)', () => {
  assertEquals(JumpAction.ARC_FRAMES, 42);
});

Deno.test('constants: RELEASE_FRAMES has 12 evenly-spread choices ending at the full arc', () => {
  const frames = ActionCatalog.RELEASE_FRAMES;
  assertEquals(frames.length, 12);
  assertEquals(frames[0], 2);
  assertEquals(frames[frames.length - 1], 42);
});

// --- ActionCatalog.all ------------------------------------------------

Deno.test('ActionCatalog.all yields 46 candidates per state (28 walk/jump/drop + 18 drop_release/run_off)', () => {
  // 2 walks + 24 jumps + 2 drops = 28
  // + 8 drop_release (4 frames × 2 dirs) + 10 run_off (5 cells × 2 dirs) = 18
  assertEquals(ActionCatalog.all().length, 46);
});

Deno.test('ActionCatalog.all includes drop_release for both dirs × 4 release frames', () => {
  const dropRelease = ActionCatalog.all().filter((a) => a instanceof DropReleaseAction);
  assertEquals(dropRelease.length, 8);
  const rightDR = dropRelease.filter((a) => a.dir === Direction.Right);
  const releases = rightDR.map((a) => a.releaseFrame).sort((a, b) => a - b);
  assertEquals(releases, [8, 16, 24, 32]);
});

Deno.test('ActionCatalog.all includes run_off for both dirs × 5 walkCells', () => {
  const runOff = ActionCatalog.all().filter((a) => a instanceof RunOffAction);
  assertEquals(runOff.length, 10);
  const rightRO = runOff.filter((a) => a.dir === Direction.Right);
  const walkCells = rightRO.map((a) => a.walkCells).sort((a, b) => a - b);
  assertEquals(walkCells, [2, 3, 4, 5, 6]);
});

Deno.test('ActionCatalog.all covers both directions for every kind', () => {
  const dirs = new Set(ActionCatalog.all().map((a) => a.dir));
  assertEquals([...dirs].sort(), [Direction.Left, Direction.Right]);
});

Deno.test('ActionCatalog.all: jump variants span the 12 release-frames', () => {
  const rightJumps = ActionCatalog.all()
    .filter((a) => a instanceof JumpAction)
    .filter((a) => a.dir === Direction.Right);
  assertEquals(rightJumps.length, 12);
  const releases = rightJumps.map((a) => a.holdFrames).sort((a, b) => a - b);
  assertEquals(releases, [...ActionCatalog.RELEASE_FRAMES]);
});

Deno.test('ActionCatalog.all: fixed order — every left action, then every right, each starting with a walk', () => {
  const all = ActionCatalog.all();
  assertEquals(all.slice(0, 23).every((a) => a.dir === Direction.Left), true);
  assertEquals(all.slice(23).every((a) => a.dir === Direction.Right), true);
  assertEquals(all[0].kind, ActionKind.Walk);
  assertEquals(all[1].kind, ActionKind.Jump);
  assertEquals(all[13].kind, ActionKind.Drop);
  assertEquals(all[14].kind, ActionKind.DropRelease);
  assertEquals(all[18].kind, ActionKind.RunOff);
  assertEquals(all[23].kind, ActionKind.Walk);
});

Deno.test('ActionCatalog.all returns the same frozen list every time', () => {
  const a = ActionCatalog.all();
  assertStrictEquals(a, ActionCatalog.all());
  assert(Object.isFrozen(a));
});
