import { assert, assertAlmostEquals, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { ActionOutcome } from './ActionOutcome.ts';
import { ActionSimulator } from './ActionSimulator.ts';
import { Direction } from './Direction.ts';
import { DropAction } from './DropAction.ts';
import { JumpAction } from './JumpAction.ts';
import { WalkAction } from './WalkAction.ts';
import type { Action } from './Action.ts';
import type { PlayerState } from './PlayerState.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

// Test level: P at (2, 1) with plenty of overhead room for jumps.
// Rows 0+1 sky (no ceiling), row 2 the play row (P at col 1, walls at
// cols 0 + 9), row 3 floor.
const FLAT = `# pickup-required: 0
..........
..........
#P.......#
##########`;

const flatStart = { x: 20, y: 40, vx: 0, vy: 0, onGround: true };

// One simulation on a fresh simulator.
function simulateOnce(text: string, startState: PlayerState, action: Action) {
  return ActionSimulator.create(jsAdapter, Level.parse(text), DEFAULT_LEGEND).simulate(startState, action);
}

// --- walk ----------------------------------------------------------

Deno.test('simulate: walk right 1 ends at the next cell, onGround', () => {
  const r = simulateOnce(FLAT, flatStart, new WalkAction(Direction.Right, 1));
  assertEquals(r.outcome, ActionOutcome.Ok);
  // Started at x=20, walked 1 cell (5 frames @ 4 px/frame = 20 px).
  assertEquals(r.endPos.x, 40);
  assertEquals(r.endCell.c, 2);
  assertEquals(r.endCell.r, 2);
  assertEquals(r.endVel.vy, 0);
  assertEquals(r.collided, false);
});

Deno.test('simulate: walk left 1 ends one cell to the left', () => {
  const r = simulateOnce(FLAT, { ...flatStart, x: 40 }, new WalkAction(Direction.Left, 1));
  assertEquals(r.outcome, ActionOutcome.Ok);
  assertEquals(r.endPos.x, 20);
  assertEquals(r.endCell.c, 1);
});

Deno.test('simulate: walk into a wall flags collided=true', () => {
  // Wall at col 3. Player at col 1 walks right toward it.
  const WALL = `# pickup-required: 0
..........
..........
#P.#.....#
##########`;
  const r = simulateOnce(WALL, { x: 20, y: 40, vx: 0, vy: 0, onGround: true }, new WalkAction(Direction.Right, 5));
  assertEquals(r.collided, true);
});

// --- jump ----------------------------------------------------------

Deno.test('simulate: jump with full holdFrames=42 carries far horizontally', () => {
  const rShort = simulateOnce(FLAT, flatStart, new JumpAction(Direction.Right, 2));
  const rLong = simulateOnce(FLAT, flatStart, new JumpAction(Direction.Right, 42));
  assertEquals(rShort.outcome, ActionOutcome.Ok);
  assertEquals(rLong.outcome, ActionOutcome.Ok);
  // Holding the direction for the whole arc travels further than letting go early.
  assert(rLong.endPos.x > rShort.endPos.x,
    `expected long > short; got short=${rShort.endPos.x} long=${rLong.endPos.x}`);
});

Deno.test('simulate: jump with release-at-2 lands near the start cell (short hop)', () => {
  const r = simulateOnce(FLAT, flatStart, new JumpAction(Direction.Right, 2));
  assertEquals(r.outcome, ActionOutcome.Ok);
  assert(r.endPos.x - flatStart.x < 40,
    `release-at-2 should travel < 2 cells horizontally; got ${r.endPos.x - flatStart.x}px`);
});

Deno.test('simulate: jump arc returns onGround at the end of cost frames', () => {
  const r = simulateOnce(FLAT, flatStart, new JumpAction(Direction.Right, 12));
  assertEquals(r.outcome, ActionOutcome.Ok);
  assertEquals(r.endVel.vy, 0); // landed
});

// --- drop ----------------------------------------------------------

Deno.test('simulate: drop right off a ledge lands on the lower floor', () => {
  //   row 0+1: sky
  //   row 2:   #.P.......       (P at col 2)
  //   row 3:   ###.......       (floor under cols 0-2)
  //   row 4:   ..........       open air
  //   row 5:   ##########       main floor
  const text = `# pickup-required: 0
..........
..........
#.P.......
###.......
..........
##########`;
  const r = simulateOnce(text, { x: 40, y: 40, vx: 0, vy: 0, onGround: true }, new DropAction(Direction.Right));
  assertEquals(r.outcome, ActionOutcome.Ok);
  // Lands on row 4 (AABB top at y=80, standing on the row-5 floor).
  assertEquals(r.endCell.r, 4, `expected to land on row 4, got ${r.endCell.r}`);
  assert(r.endCell.c >= 3, `expected to drift right, got col ${r.endCell.c}`);
});

// --- start-state round-trip ----------------------------------------

Deno.test('simulate: sub-pixel start position is preserved (no quantization on input)', () => {
  // Start at x=23.5 — between cells. 5 frames at 4 px/frame = 20 px.
  const r = simulateOnce(FLAT, { x: 23.5, y: 40, vx: 0, vy: 0, onGround: true }, new WalkAction(Direction.Right, 1));
  assertEquals(r.endPos.x, 43.5);
});

// --- endState and trajectory -------------------------------------------

Deno.test('simulate returns endState matching endPos/endVel', () => {
  const simulator = ActionSimulator.create(jsAdapter, Level.parse('# size: 6x4\n######\n#P..E#\n######'), DEFAULT_LEGEND);
  const result = simulator.simulate(
    { x: 20, y: 20, vx: 0, vy: 0, onGround: true },
    new WalkAction(Direction.Right, 1),
  );
  assert(result.endState, 'expected endState');
  assertEquals(Object.keys(result.endState).sort(), ['onGround', 'vx', 'vy', 'x', 'y']);
  assertAlmostEquals(result.endState.x, result.endPos.x, 5e-6);
  assertAlmostEquals(result.endState.y, result.endPos.y, 5e-6);
});

Deno.test('simulate returns a trajectory only when collectTrajectory is set', () => {
  const simulator = ActionSimulator.create(jsAdapter, Level.parse('# size: 10x4\n##########\n#P......E#\n##########'), DEFAULT_LEGEND);
  const start = { x: 20, y: 20, vx: 0, vy: 0, onGround: true };
  const a = simulator.simulate(start, new JumpAction(Direction.Right, 20));
  const b = simulator.simulate(start, new JumpAction(Direction.Right, 20), { collectTrajectory: true });
  assertEquals(a.trajectory, null);
  assert(Array.isArray(b.trajectory));
  assert(b.trajectory.length > 0);
  const sampleFrame = b.trajectory[0];
  assert('x' in sampleFrame);
  assert('y' in sampleFrame);
});

Deno.test('one simulator gives the same result for the same simulation, whatever ran before', () => {
  // The scene is reset before each simulation.
  const simulator = ActionSimulator.create(jsAdapter, Level.parse(FLAT), DEFAULT_LEGEND);
  const first = simulator.simulate(flatStart, new JumpAction(Direction.Right, 12));
  simulator.simulate({ ...flatStart, x: 60 }, new WalkAction(Direction.Left, 1));
  const again = simulator.simulate(flatStart, new JumpAction(Direction.Right, 12));
  assertEquals(again, first);
});
