import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import {
  buildNavGraph,
  JUMP_MAX_HORIZ_CELLS,
  JUMP_MAX_VERT_CELLS,
  cellKey,
  stateKey,
  settle,
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

// (v21: isLineClear was a v20 helper for the straight-line jump
// check; v21 replaced jump validation with full physics simulation
// via simAction, so the helper is no longer exported.)

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

// v26 M4: helper — extract the cell prefix from a stateKey
// `"r,c,vxBucket"`. Tests assert by cell rather than by full
// state — vxBucket may legitimately vary based on the action.
const cellOf = (stateK) => stateK.split(',').slice(0, 2).join(',');

test('buildNavGraph: walk edges between adjacent grounded cells', () => {
  // Flat 5-wide floor, player + exit on row 1.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // From (1, 2) bucket-0 — middle cell — should have walk edges to
  // (1, 1) and (1, 3) (vxBucket variants don't matter for assertion).
  const mid = g.edges.get(stateKey(1, 2, 0));
  const walks = mid.filter((e) => e.kind === 'walk');
  const targets = [...new Set(walks.map((e) => cellOf(e.to)))].sort();
  assert.deepEqual(targets, ['1,1', '1,3']);
});

test('buildNavGraph: hazard cells produce no walk edges to/from', () => {
  // P – walk – (1,2) – walk – (1,3) blocked because (1,3) is ^.
  const parsed = parse('#####\n#P.^E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // The hazard cell isn't in the node map under any vxBucket.
  assert.equal(g.nodes.has(stateKey(1, 3, 0)), false);
  // From (1, 2) bucket-0, no walk edge to any (1, 3, *) state.
  const mid = g.edges.get(stateKey(1, 2, 0));
  const cellTargets = mid.map((e) => cellOf(e.to));
  assert.equal(cellTargets.includes('1,3'), false);
});

test('buildNavGraph: drop edge off a ledge to lower platform', () => {
  // Player walks off the right edge of the upper platform and lands
  // on the lower platform.
  const text = [
    '##........',
    '##........',
    '#P........',
    '###.......', // floor at row 3 cols 0-2; cells 3+ open
    '...#######', // floor at row 4 cols 3-9
  ].join('\n');
  const parsed = parse(text);
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  // From (2, 2): grounded by row 3 col 2 = `#`. drop_right walks off
  // the right ledge (row 3 col 3 = `.`) and falls to the lower
  // platform (row 4 cols 3-9 = `#`).
  //
  // v21 drift note: the drop action holds the direction key for the
  // full fall (not just the first cell of motion as v20's discrete
  // edge model assumed), so the landing cell drifts further right
  // than v20's "land directly below the ledge edge". Test only that
  // SOME drop edge lands on row 3 (which is the row whose AABB
  // centre sits on top of the row-4 floor at y=80).
  const edgesFromMid = g.edges.get(stateKey(2, 2, 0));
  const drops = edgesFromMid.filter((e) => e.kind === 'drop');
  assert.ok(drops.length > 0, 'expected at least one drop edge');
  // Drop right ends somewhere on row 3 (cell centre y=70 → row 3).
  const rightDrops = drops.filter((d) => d.dir === 'right');
  assert.ok(rightDrops.length > 0);
  assert.ok(rightDrops[0].to.startsWith('3,'), `expected row 3, got ${rightDrops[0].to}`);
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
  const fromSpawn = g.edges.get(stateKey(1, 1, 0));
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert.ok(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
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
  const fromSpawn = g.edges.get(stateKey(1, 1, 0));
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert.ok(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
});

test('buildNavGraph: spawn-cell node + edge map non-empty for trivial level', () => {
  // The smoke case: a 3-col flat level should yield nodes + edges.
  // v26 M4: each cell expands to 3 vxBucket variants → ≥ 9 nodes
  // for a 3-cell level.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(parsed, DEFAULT_LEGEND);
  assert.ok(g.nodes.size >= 9); // 3 cells × 3 vxBuckets
  assert.ok(g.edges.get(stateKey(1, 1, 0)).length > 0);
});
