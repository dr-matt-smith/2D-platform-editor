import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import {
  buildNavGraph,
  JUMP_MAX_HORIZ_CELLS,
  JUMP_MAX_VERT_CELLS,
  cellKey,
  settle,
  isLineClear,
} from './grid.js';

// --- physics constants are exposed as reach envelope --------------

test('jump reach envelope: derived from physics — ~8 horizontal, ~4 vertical', () => {
  // With SPEED=240, JUMP_FORCE=560, GRAVITY=1600, TILE=20:
  //   horiz = floor(SPEED * 2*JUMP_FORCE/GRAVITY / TILE) = floor(168/20) = 8
  //   vert  = floor(JUMP_FORCE^2 / (2*GRAVITY) / TILE)   = floor(98/20)  = 4
  assert.equal(JUMP_MAX_HORIZ_CELLS, 8);
  assert.equal(JUMP_MAX_VERT_CELLS, 4);
});

// --- helpers -----------------------------------------------------

test('settle: lands on first grounded cell below the start', () => {
  const parsed = parse('.....\n.....\n.....\n#####');
  const cell = settle(parsed.grid, 0, 2);
  assert.deepEqual(cell, { r: 2, c: 2 }); // last walkable cell above the floor
});

test('settle: falls off the world → null', () => {
  const parsed = parse('.....\n.....');
  const cell = settle(parsed.grid, 0, 2);
  assert.equal(cell, null);
});

test('isLineClear: passes when no `#` between cells', () => {
  const parsed = parse('.....\n.....\n#####');
  // Row 0 to row 0, col 0 to col 4. The straight line samples row 0
  // cols 1..3 (all `.`), no solids.
  assert.equal(isLineClear(parsed.grid, 0, 0, 0, 4), true);
});

test('isLineClear: rejects when a `#` is on the straight path', () => {
  const parsed = parse('..#..\n.....\n#####');
  // Row 0 col 0 to row 0 col 4: samples col 1 (.), col 2 (#) → blocked.
  assert.equal(isLineClear(parsed.grid, 0, 0, 0, 4), false);
});

// --- buildNavGraph: start / pickups / exit extraction ----------

test('buildNavGraph: locates P spawn (settled) + E + pickups', () => {
  // P high above the floor; spawn settles to (3, 1).
  const text = '#####\n#P..#\n#...#\n#.oE#\n#####';
  const parsed = parse(text);
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  assert.deepEqual(g.start, { r: 3, c: 1 });
  assert.deepEqual(g.pickupCells, [{ r: 3, c: 2 }]);
  assert.deepEqual(g.exitCells, [{ r: 3, c: 3 }]);
});

test('buildNavGraph: walk edges between adjacent grounded cells', () => {
  // Flat 5-wide floor, player + exit on row 1.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // From (1, 2) — middle cell — should have walk edges to (1, 1) and (1, 3).
  const mid = g.edges.get(cellKey(1, 2));
  const walks = mid.filter((e) => e.kind === 'walk');
  const targets = walks.map((e) => e.to).sort();
  assert.deepEqual(targets, ['1,1', '1,3']);
});

test('buildNavGraph: hazard cells produce no walk edges to/from', () => {
  // P – walk – (1,2) – walk – (1,3) blocked because (1,3) is ^.
  const parsed = parse('#####\n#P.^E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // The hazard cell is not in the node map (not walkable).
  assert.equal(g.nodes.has('1,3'), false);
  // From (1, 2), no walk edge to (1, 3).
  const mid = g.edges.get(cellKey(1, 2));
  const targets = mid.map((e) => e.to);
  assert.equal(targets.includes('1,3'), false);
});

test('buildNavGraph: drop edge off a ledge to lower platform', () => {
  // Two platforms with a 1-col gap; player walks off, falls 2 rows.
  const text = [
    '##........',
    '##........',
    '#P........',
    '###.......', // floor at row 3 cols 0-2; cells 3+ open
    '...#######', // floor at row 4 cols 3-9
  ].join('\n');
  const parsed = parse(text);
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // From (2, 1) — but spawn settles to (2, 1)? Let me find a clearer
  // ground cell with a drop. Take (2, 2): grounded by # at (3, 2).
  // Wait (2, 2) is `.` at row 2 col 2; row 3 col 2 is `#`. Grounded.
  // Walking right to (2, 3): row 3 col 3 is `.` → not grounded → drop.
  // Falls to (3, 3) which is `.` → keep falling → (4, 3) which is `#` ...
  // wait `isWalkable(4, 3)` checks grid[4][3] which is `#` (in the
  // bottom floor row), so NOT walkable. settle stops one above:
  // (3, 3) is walkable AND grounded (4, 3 is `#`). So drop to (3, 3).
  const edgesFromMid = g.edges.get(cellKey(2, 2));
  const drops = edgesFromMid.filter((e) => e.kind === 'drop');
  assert.ok(drops.length > 0);
  assert.equal(drops[0].to, '3,3');
});

test('buildNavGraph: jump edge between two platforms across a gap', () => {
  // Two grounded platforms in row 1, separated by 3 cells. Open sky
  // above (no ceiling clamp).
  //   row 0: . . . . . . . . .
  //   row 1: # P . . . . E . #     (P col 1 grounded; E col 6 grounded)
  //   row 2: # # . . . . # # #     (floor under cols 0,1 + 6,7,8; gap 2-5)
  //   row 3: . . . . . . . . .
  //   row 4: # # # # # # # # #
  const text = [
    '.........',
    '#P....E.#',
    '##....###',
    '.........',
    '#########',
  ].join('\n');
  const parsed = parse(text);
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // From (1, 1) — player spawn ground — there should be a jump edge
  // reaching across the gap to (1, 6).
  const fromSpawn = g.edges.get(cellKey(1, 1));
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachable = jumps.map((e) => e.to);
  assert.ok(reachable.includes('1,6'), `jumps: ${reachable.join(', ')}`);
});

test('buildNavGraph: jump arc clears a single-column wall (v20.1 parabola check)', () => {
  // v20 (straight-line check) used to reject this jump because the
  // line from (1, 1) to (1, 6) crosses the wall at (1, 4). v20.1's
  // parabola sampler instead traces the actual arc, which goes high
  // enough to clear the wall — so the agent CAN propose the jump.
  // (Whether the player actually lands at (1, 6) with held-direction
  // physics is a separate question the runner's sim validates +
  // replans against; see the v20 transcript's "release direction
  // mid-jump" carry-forward.)
  const text = [
    '.........',
    '#P..#.E.#',
    '##..#.###',
    '.........',
    '#########',
  ].join('\n');
  const parsed = parse(text);
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  const fromSpawn = g.edges.get(cellKey(1, 1));
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachable = jumps.map((e) => e.to);
  assert.ok(reachable.includes('1,6'), `jumps: ${reachable.join(', ')}`);
});

test('buildNavGraph: spawn-cell node + edge map non-empty for trivial level', () => {
  // The smoke case: a 3-col flat level should yield nodes + edges.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  assert.ok(g.nodes.size >= 3); // P, ., E cells
  assert.ok(g.edges.get(cellKey(1, 1)).length > 0);
});
