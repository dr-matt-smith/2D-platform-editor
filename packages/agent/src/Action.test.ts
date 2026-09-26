import { assert, assertEquals, assertFalse } from '@std/assert';
import { ActionKind } from './ActionKind.ts';
import { Direction } from './Direction.ts';
import { DropAction } from './DropAction.ts';
import { DropReleaseAction } from './DropReleaseAction.ts';
import { JumpAction } from './JumpAction.ts';
import { RunOffAction } from './RunOffAction.ts';
import { WaitAction } from './WaitAction.ts';
import { WalkAction } from './WalkAction.ts';

// --- nominalCost -----------------------------------------------------

Deno.test('nominalCost: walk N cells = N * 5 frames', () => {
  assertEquals(new WalkAction(Direction.Right, 3).nominalCost, 15);
  assertEquals(new WalkAction(Direction.Left, 1).nominalCost, 5);
});

Deno.test('nominalCost: jump = JumpAction.ARC_FRAMES regardless of holdFrames', () => {
  assertEquals(new JumpAction(Direction.Right, 2).nominalCost, JumpAction.ARC_FRAMES);
  assertEquals(new JumpAction(Direction.Left, 42).nominalCost, JumpAction.ARC_FRAMES);
});

Deno.test('nominalCost: wait N frames = N', () => {
  assertEquals(new WaitAction(17).nominalCost, 17);
});

Deno.test('nominalCost: drops budget 60 frames; run_off adds its walk', () => {
  assertEquals(new DropAction(Direction.Left).nominalCost, 60);
  assertEquals(new DropReleaseAction(Direction.Left, 8).nominalCost, 60);
  assertEquals(new RunOffAction(Direction.Right, 3).nominalCost, 75);
});

// --- toRecording -----------------------------------------------------

Deno.test('toRecording: walk emits hold + release of the direction key', () => {
  const events = new WalkAction(Direction.Right, 2).toRecording(10);
  assertEquals(events, [
    { frame: 10, key: 'right', down: true },
    { frame: 20, key: 'right', down: false },
  ]);
});

Deno.test('toRecording: jump emits dir+space press, space release at +1, dir release at +holdFrames', () => {
  const events = new JumpAction(Direction.Left, 26).toRecording(100);
  assertEquals(events.length, 4);
  // Frame 100: dir down + space down.
  assertEquals(events[0], { frame: 100, key: 'left', down: true });
  assertEquals(events[1], { frame: 100, key: 'space', down: true });
  // Frame 101: space release (one-shot).
  assertEquals(events[2], { frame: 101, key: 'space', down: false });
  // Frame 126 (= 100 + 26): dir release.
  assertEquals(events[3], { frame: 126, key: 'left', down: false });
});

Deno.test('toRecording: drop_release releases dir at releaseFrame', () => {
  const events = new DropReleaseAction(Direction.Right, 16).toRecording(50);
  assertEquals(events, [
    { frame: 50, key: 'right', down: true },
    { frame: 66, key: 'right', down: false },
  ]);
});

Deno.test('toRecording: run_off holds dir for walkCells*5 + 60 frames', () => {
  const events = new RunOffAction(Direction.Left, 3).toRecording(0);
  // 3 cells × 5 frames = 15, + 60 fall buffer = 75 total.
  assertEquals(events, [
    { frame: 0, key: 'left', down: true },
    { frame: 75, key: 'left', down: false },
  ]);
});

Deno.test('toRecording: jump with full-arc holdFrames=42 releases at end of arc', () => {
  const events = new JumpAction(Direction.Right, 42).toRecording(0);
  const dirRelease = events.find((e) => e.key === 'right' && !e.down);
  assertEquals(dirRelease!.frame, 42);
});

Deno.test('toRecording: drop emits hold + release of the direction over the fall budget', () => {
  const events = new DropAction(Direction.Right).toRecording(0);
  assertEquals(events.length, 2);
  assertEquals(events[0], { frame: 0, key: 'right', down: true });
  // Release at the drop budget (60 frames).
  assertEquals(events[1].down, false);
  assert(events[1].frame >= 30);
});

Deno.test('toRecording: wait emits no events', () => {
  assertEquals(new WaitAction(20).toRecording(0), []);
});

Deno.test('toRecording: frameStart defaults to 0', () => {
  assertEquals(new WalkAction(Direction.Left, 1).toRecording()[0].frame, 0);
});

// --- describe --------------------------------------------------------

Deno.test('describe: walk renders cell count + direction', () => {
  assertEquals(
    new WalkAction(Direction.Right, 1).describe('exit at (5,3)'),
    'walk right 1 cell toward exit at (5,3)',
  );
  assertEquals(
    new WalkAction(Direction.Left, 3).describe('pickup #1 at (2,4)'),
    'walk left 3 cells toward pickup #1 at (2,4)',
  );
});

Deno.test('describe: jump includes release-frame info', () => {
  assertEquals(
    new JumpAction(Direction.Left, 26).describe('pickup #2 at (5,8)'),
    'jump left (release at frame 26) toward pickup #2 at (5,8)',
  );
});

Deno.test('describe: drop reads naturally', () => {
  assertEquals(
    new DropAction(Direction.Right).describe('exit at (9,21)'),
    'drop off ledge right toward exit at (9,21)',
  );
});

Deno.test('describe: missing subgoal name produces a still-readable string', () => {
  assertEquals(new WalkAction(Direction.Right, 1).describe(), 'walk right 1 cell');
});

Deno.test('describe: drop_release, run_off and wait', () => {
  assertEquals(new DropReleaseAction(Direction.Left, 8).describe('exit'), 'drop left (release at frame 8) toward exit');
  assertEquals(new RunOffAction(Direction.Right, 2).describe(), 'walk right 2 cells then carry into fall');
  assertEquals(new WaitAction(1).describe(), 'wait 1 frame');
  assertEquals(new WaitAction(3).describe(), 'wait 3 frames');
});

// --- leavesGround, kind and sortKey ----------------------------------

Deno.test('leavesGround: only walking and waiting stay on the ground', () => {
  assertFalse(new WalkAction(Direction.Right, 1).leavesGround);
  assertFalse(new WaitAction(5).leavesGround);
  assert(new JumpAction(Direction.Right, 2).leavesGround);
  assert(new DropAction(Direction.Right).leavesGround);
  assert(new DropReleaseAction(Direction.Right, 8).leavesGround);
  assert(new RunOffAction(Direction.Right, 2).leavesGround);
});

Deno.test('kind: each class reports its ActionKind', () => {
  assertEquals(new WalkAction(Direction.Right, 1).kind, ActionKind.Walk);
  assertEquals(new JumpAction(Direction.Right, 2).kind, ActionKind.Jump);
  assertEquals(new DropAction(Direction.Right).kind, ActionKind.Drop);
  assertEquals(new DropReleaseAction(Direction.Right, 8).kind, ActionKind.DropRelease);
  assertEquals(new RunOffAction(Direction.Right, 2).kind, ActionKind.RunOff);
  assertEquals(new WaitAction(1).kind, ActionKind.Wait);
});

Deno.test('sortKey: kind|dir|holdFrames|releaseFrame|walkCells, blank where not used', () => {
  assertEquals(new WalkAction(Direction.Left, 1).sortKey, 'walk|left|||');
  assertEquals(new JumpAction(Direction.Right, 12).sortKey, 'jump|right|12||');
  assertEquals(new DropAction(Direction.Right).sortKey, 'drop|right|||');
  assertEquals(new DropReleaseAction(Direction.Left, 8).sortKey, 'drop_release|left||8|');
  assertEquals(new RunOffAction(Direction.Left, 3).sortKey, 'run_off|left|||3');
});
