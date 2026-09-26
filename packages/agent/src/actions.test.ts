import { assert, assertEquals } from '@std/assert';
import {
  enumerateActions,
  actionCost,
  actionToRecording,
  actionToWhy,
  WALK_FRAMES_PER_CELL,
  JUMP_ARC_FRAMES,
  RELEASE_FRAMES,
} from './actions.ts';

// --- constants derived from physics ----------------------------------

Deno.test('constants: WALK_FRAMES_PER_CELL = 5 (TILE 20 / SPEED 240 = 1/12s = 5 frames @ 60fps)', () => {
  assertEquals(WALK_FRAMES_PER_CELL, 5);
});

Deno.test('constants: JUMP_ARC_FRAMES = 42 (2 * JUMP_FORCE / GRAVITY * 60)', () => {
  assertEquals(JUMP_ARC_FRAMES, 42);
});

Deno.test('constants: RELEASE_FRAMES has 12 evenly-spread choices ending at the full arc', () => {
  assertEquals(RELEASE_FRAMES.length, 12);
  assertEquals(RELEASE_FRAMES[0], 2);
  assertEquals(RELEASE_FRAMES[RELEASE_FRAMES.length - 1], 42);
});

// --- enumerateActions -----------------------------------------------

Deno.test('enumerateActions yields 46 candidates per cell (v23 = v21 28 + 18 new)', () => {
  const actions = enumerateActions();
  // v21: 2 walks + 24 jumps + 2 drops = 28
  // v23 M6: + 8 drop_release (4 frames × 2 dirs) + 10 run_off (5 cells × 2 dirs) = 18
  assertEquals(actions.length, 46);
});

Deno.test('v23 M6: enumerateActions includes drop_release for both dirs × 4 release frames', () => {
  const actions = enumerateActions();
  const dropRelease = actions.filter((a) => a.kind === 'drop_release');
  assertEquals(dropRelease.length, 8);
  const rightDR = dropRelease.filter((a) => a.params.dir === 'right');
  const releases = rightDR.map((a) => a.params.releaseFrame).sort((a, b) => a - b);
  assertEquals(releases, [8, 16, 24, 32]);
});

Deno.test('v23 M6: enumerateActions includes run_off for both dirs × 5 walkCells', () => {
  const actions = enumerateActions();
  const runOff = actions.filter((a) => a.kind === 'run_off');
  assertEquals(runOff.length, 10);
  const rightRO = runOff.filter((a) => a.params.dir === 'right');
  const walkCells = rightRO.map((a) => a.params.walkCells).sort((a, b) => a - b);
  assertEquals(walkCells, [2, 3, 4, 5, 6]);
});

Deno.test('enumerateActions covers both directions for every kind', () => {
  const actions = enumerateActions();
  const dirs = new Set(actions.map((a) => a.params.dir));
  assertEquals([...dirs].sort(), ['left', 'right']);
});

Deno.test('enumerateActions: jump variants span the 12 release-frames', () => {
  const actions = enumerateActions();
  const rightJumps = actions.filter((a) => a.kind === 'jump' && a.params.dir === 'right');
  assertEquals(rightJumps.length, 12);
  const releases = rightJumps.map((a) => a.params.holdFrames!).sort((a, b) => a - b);
  assertEquals(releases, RELEASE_FRAMES);
});

// --- actionCost ------------------------------------------------------

Deno.test('actionCost: walk N cells = N * 5 frames', () => {
  assertEquals(actionCost({ kind: 'walk', params: { dir: 'right', cells: 3 } }), 15);
  assertEquals(actionCost({ kind: 'walk', params: { dir: 'left', cells: 1 } }), 5);
});

Deno.test('actionCost: jump = JUMP_ARC_FRAMES regardless of holdFrames', () => {
  assertEquals(actionCost({ kind: 'jump', params: { dir: 'right', holdFrames: 2 } }), JUMP_ARC_FRAMES);
  assertEquals(actionCost({ kind: 'jump', params: { dir: 'left', holdFrames: 42 } }), JUMP_ARC_FRAMES);
});

Deno.test('actionCost: wait N frames = N', () => {
  assertEquals(actionCost({ kind: 'wait', params: { frames: 17 } }), 17);
});

// --- actionToRecording ----------------------------------------------

Deno.test('actionToRecording: walk emits hold + release of the direction key', () => {
  const events = actionToRecording({ kind: 'walk', params: { dir: 'right', cells: 2 } }, 10);
  assertEquals(events, [
    { frame: 10, key: 'right', down: true },
    { frame: 20, key: 'right', down: false },
  ]);
});

Deno.test('actionToRecording: jump emits dir+space press, space release at +1, dir release at +holdFrames', () => {
  const events = actionToRecording({ kind: 'jump', params: { dir: 'left', holdFrames: 26 } }, 100);
  assertEquals(events.length, 4);
  // Frame 100: dir down + space down.
  assertEquals(events[0], { frame: 100, key: 'left', down: true });
  assertEquals(events[1], { frame: 100, key: 'space', down: true });
  // Frame 101: space release (one-shot).
  assertEquals(events[2], { frame: 101, key: 'space', down: false });
  // Frame 126 (= 100 + 26): dir release.
  assertEquals(events[3], { frame: 126, key: 'left', down: false });
});

Deno.test('v23 M6: actionToRecording for drop_release releases dir at releaseFrame', () => {
  const events = actionToRecording({ kind: 'drop_release', params: { dir: 'right', releaseFrame: 16 } }, 50);
  assertEquals(events, [
    { frame: 50, key: 'right', down: true },
    { frame: 66, key: 'right', down: false },
  ]);
});

Deno.test('v23 M6: actionToRecording for run_off holds dir for walkCells*5 + 60 frames', () => {
  const events = actionToRecording({ kind: 'run_off', params: { dir: 'left', walkCells: 3 } }, 0);
  // 3 cells × 5 frames = 15, + 60 fall buffer = 75 total.
  assertEquals(events, [
    { frame: 0, key: 'left', down: true },
    { frame: 75, key: 'left', down: false },
  ]);
});

Deno.test('actionToRecording: jump with full-arc holdFrames=42 releases at end of arc', () => {
  const events = actionToRecording({ kind: 'jump', params: { dir: 'right', holdFrames: 42 } }, 0);
  const dirRelease = events.find((e) => e.key === 'right' && !e.down);
  assertEquals(dirRelease!.frame, 42);
});

Deno.test('actionToRecording: drop emits hold + release of the direction over the fall budget', () => {
  const events = actionToRecording({ kind: 'drop', params: { dir: 'right' } }, 0);
  assertEquals(events.length, 2);
  assertEquals(events[0], { frame: 0, key: 'right', down: true });
  // Release at the drop budget (60 frames).
  assertEquals(events[1].down, false);
  assert(events[1].frame >= 30);
});

Deno.test('actionToRecording: wait emits no events', () => {
  const events = actionToRecording({ kind: 'wait', params: { frames: 20 } }, 0);
  assertEquals(events, []);
});

// --- actionToWhy -----------------------------------------------------

Deno.test('actionToWhy: walk renders cell count + direction', () => {
  assertEquals(
    actionToWhy({ kind: 'walk', params: { dir: 'right', cells: 1 } }, 'exit at (5,3)'),
    'walk right 1 cell toward exit at (5,3)',
  );
  assertEquals(
    actionToWhy({ kind: 'walk', params: { dir: 'left', cells: 3 } }, 'pickup #1 at (2,4)'),
    'walk left 3 cells toward pickup #1 at (2,4)',
  );
});

Deno.test('actionToWhy: jump includes release-frame info — the v21 explainable why:', () => {
  assertEquals(
    actionToWhy({ kind: 'jump', params: { dir: 'left', holdFrames: 26 } }, 'pickup #2 at (5,8)'),
    'jump left (release at frame 26) toward pickup #2 at (5,8)',
  );
});

Deno.test('actionToWhy: drop reads naturally', () => {
  assertEquals(
    actionToWhy({ kind: 'drop', params: { dir: 'right' } }, 'exit at (9,21)'),
    'drop off ledge right toward exit at (9,21)',
  );
});

Deno.test('actionToWhy: missing subgoal name produces a still-readable string', () => {
  assertEquals(actionToWhy({ kind: 'walk', params: { dir: 'right', cells: 1 } }), 'walk right 1 cell');
});
