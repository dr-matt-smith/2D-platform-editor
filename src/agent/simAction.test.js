import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import { simulateAction } from './simAction.js';

// Test level: P at (2, 1) with plenty of overhead room for jumps.
// 10 cols × 4 rows. Row 0+1 sky (no ceiling), row 2 the play row
// (P at col 1, walls cols 0 + 9), row 3 floor.
const FLAT = `# pickup-required: 0
..........
..........
#P.......#
##########`;

const flatStart = { x: 20, y: 40, vx: 0, vy: 0, onGround: true };

// --- walk ----------------------------------------------------------

test('simulateAction: walk_right_1 ends at the next cell, onGround', () => {
  const parsed = parse(FLAT);
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: flatStart,
    action: { kind: 'walk', params: { dir: 'right', cells: 1 } },
  });
  assert.equal(r.outcome, 'ok');
  // Player started at x=20, walked 1 cell (5 frames @ 4 px/frame = 20 px).
  assert.equal(r.endPos.x, 40);
  assert.equal(r.endCell.c, 2);
  assert.equal(r.endCell.r, 2);
  assert.equal(r.endVel.vy, 0);
  assert.equal(r.collided, false);
});

test('simulateAction: walk_left_1 ends one cell to the left', () => {
  const parsed = parse(FLAT);
  const start = { ...flatStart, x: 40 };
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: start,
    action: { kind: 'walk', params: { dir: 'left', cells: 1 } },
  });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.endPos.x, 20);
  assert.equal(r.endCell.c, 1);
});

test('simulateAction: walk into a wall flags collided=true', () => {
  // Wall at col 3. Player at col 1 walks right toward it.
  const WALL = `# pickup-required: 0
..........
..........
#P.#.....#
##########`;
  const parsed = parse(WALL);
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: { x: 20, y: 40, vx: 0, vy: 0, onGround: true },
    action: { kind: 'walk', params: { dir: 'right', cells: 5 } },
  });
  assert.equal(r.collided, true);
});

// --- jump ----------------------------------------------------------

test('simulateAction: jump with full holdFrames=42 carries far horizontally', () => {
  const parsed = parse(FLAT);
  const rShort = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: flatStart,
    action: { kind: 'jump', params: { dir: 'right', holdFrames: 2 } },
  });
  const rLong = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: flatStart,
    action: { kind: 'jump', params: { dir: 'right', holdFrames: 42 } },
  });
  // Both land back on row 1 (the play floor); both should be 'ok'.
  assert.equal(rShort.outcome, 'ok');
  assert.equal(rLong.outcome, 'ok');
  // The full-arc jump should travel further horizontally than the
  // release-at-2 jump (the release-mid-arc unlock in action).
  assert.ok(rLong.endPos.x > rShort.endPos.x,
    `expected long > short; got short=${rShort.endPos.x} long=${rLong.endPos.x}`);
});

test('simulateAction: jump with release-at-2 lands near the start cell (short hop)', () => {
  const parsed = parse(FLAT);
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: flatStart,
    action: { kind: 'jump', params: { dir: 'right', holdFrames: 2 } },
  });
  assert.equal(r.outcome, 'ok');
  // Released after 2 frames → travels at most ~2 cells; usually < 1 cell.
  assert.ok(r.endPos.x - flatStart.x < 40,
    `release-at-2 should travel < 2 cells horizontally; got ${r.endPos.x - flatStart.x}px`);
});

test('simulateAction: jump arc returns onGround at the end of cost frames', () => {
  const parsed = parse(FLAT);
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: flatStart,
    action: { kind: 'jump', params: { dir: 'right', holdFrames: 12 } },
  });
  assert.equal(r.outcome, 'ok');
  assert.equal(r.endVel.vy, 0); // landed
});

// --- drop ----------------------------------------------------------

test('simulateAction: drop_right off a ledge lands on the lower floor', () => {
  // Two-platform setup; player at (2, 2) drops off the right edge,
  // falls to the main floor at row 4.
  //   row 0+1: sky (jump headroom)
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
  const parsed = parse(text);
  const start = { x: 40, y: 40, vx: 0, vy: 0, onGround: true };
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: start,
    action: { kind: 'drop', params: { dir: 'right' } },
  });
  assert.equal(r.outcome, 'ok');
  // Lands on row 4 (player AABB top at y=80 = row 4, supported by
  // row 5 floor at y=100).
  assert.equal(r.endCell.r, 4, `expected to land on row 4, got ${r.endCell.r}`);
  assert.ok(r.endCell.c >= 3, `expected to drift right, got col ${r.endCell.c}`);
});

// --- start-state round-trip ----------------------------------------

test('simulateAction: sub-pixel start position is preserved (no quantization on input)', () => {
  const parsed = parse(FLAT);
  // Start at x=23.5 — between cells.
  const start = { x: 23.5, y: 40, vx: 0, vy: 0, onGround: true };
  const r = simulateAction({
    parsed,
    legend: DEFAULT_LEGEND,
    startState: start,
    action: { kind: 'walk', params: { dir: 'right', cells: 1 } },
  });
  // Walked 5 frames at 4 px/frame = 20 px; new x = 43.5.
  assert.equal(r.endPos.x, 43.5);
});
