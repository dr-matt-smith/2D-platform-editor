import { assert, assertEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import {
  buildNavGraph,
  JUMP_MAX_HORIZ_CELLS,
  JUMP_MAX_VERT_CELLS,
  cellKey,
  stateKey,
  settle,
  parseStateKey,
  vxBucketOf,
  VX_BUCKETS,
  xOffsetBucketOf,
  X_OFFSET_BUCKETS,
  bucketCentreX,
} from './grid.ts';

// --- physics constants are exposed as reach envelope --------------

Deno.test('jump reach envelope: derived from physics — ~8 horizontal, ~4 vertical', () => {
  // With SPEED=240, JUMP_FORCE=560, GRAVITY=1600, TILE=20:
  //   horiz = floor(SPEED * 2*JUMP_FORCE/GRAVITY / TILE) = floor(168/20) = 8
  //   vert  = floor(JUMP_FORCE^2 / (2*GRAVITY) / TILE)   = floor(98/20)  = 4
  assertEquals(JUMP_MAX_HORIZ_CELLS, 8);
  assertEquals(JUMP_MAX_VERT_CELLS, 4);
});

// --- helpers -----------------------------------------------------

Deno.test('settle: lands on first grounded cell below the start', () => {
  const parsed = parse('.....\n.....\n.....\n#####');
  const cell = settle(parsed.grid, 0, 2);
  assertEquals(cell, { r: 2, c: 2 }); // last walkable cell above the floor
});

Deno.test('settle: falls off the world → null', () => {
  const parsed = parse('.....\n.....');
  const cell = settle(parsed.grid, 0, 2);
  assertEquals(cell, null);
});

// (v21: isLineClear was a v20 helper for the straight-line jump
// check; v21 replaced jump validation with full physics simulation
// via simAction, so the helper is no longer exported.)

// --- buildNavGraph: start / pickups / exit extraction ----------

Deno.test('buildNavGraph: locates P spawn (settled) + E + pickups', () => {
  // P high above the floor; spawn settles to (3, 1).
  const text = '#####\n#P..#\n#...#\n#.oE#\n#####';
  const parsed = parse(text);
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  assertEquals(g.start, { r: 3, c: 1 });
  assertEquals(g.pickupCells, [{ r: 3, c: 2 }]);
  assertEquals(g.exitCells, [{ r: 3, c: 3 }]);
});

// v26 M4: helper — extract the cell prefix from a stateKey
// `"r,c,vxBucket"`. Tests assert by cell rather than by full
// state — vxBucket may legitimately vary based on the action.
const cellOf = (stateK: string) => stateK.split(',').slice(0, 2).join(',');

Deno.test('buildNavGraph: walk edges between adjacent grounded cells', () => {
  // Flat 5-wide floor, player + exit on row 1.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // From (1, 2) bucket-0 — middle cell — should have walk edges to
  // (1, 1) and (1, 3) (vxBucket variants don't matter for assertion).
  const mid = g.edges.get(stateKey(1, 2, 0, 'L'))!;
  const walks = mid.filter((e) => e.kind === 'walk');
  const targets = [...new Set(walks.map((e) => cellOf(e.to)))].sort();
  assertEquals(targets, ['1,1', '1,3']);
});

Deno.test('buildNavGraph: hazard cells produce no walk edges to/from', () => {
  // P – walk – (1,2) – walk – (1,3) blocked because (1,3) is ^.
  const parsed = parse('#####\n#P.^E#\n#####');
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // The hazard cell isn't in the node map under any vxBucket.
  assertEquals(g.nodes.has(stateKey(1, 3, 0, 'L')), false);
  // From (1, 2) bucket-0, no walk edge to any (1, 3, *) state.
  const mid = g.edges.get(stateKey(1, 2, 0, 'L'))!;
  const cellTargets = mid.map((e) => cellOf(e.to));
  assertEquals(cellTargets.includes('1,3'), false);
});

Deno.test('buildNavGraph: drop edge off a ledge to lower platform', () => {
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
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
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
  const edgesFromMid = g.edges.get(stateKey(2, 2, 0, 'L'))!;
  const drops = edgesFromMid.filter((e) => e.kind === 'drop');
  assert(drops.length > 0, 'expected at least one drop edge');
  // Drop right ends somewhere on row 3 (cell centre y=70 → row 3).
  const rightDrops = drops.filter((d) => d.dir === 'right');
  assert(rightDrops.length > 0);
  assert(rightDrops[0].to.startsWith('3,'), `expected row 3, got ${rightDrops[0].to}`);
});

Deno.test('buildNavGraph: jump edge between two platforms across a gap', () => {
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
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // From (1, 1) — player spawn ground — there should be a jump edge
  // reaching across the gap to (1, 6).
  const fromSpawn = g.edges.get(stateKey(1, 1, 0, 'L'))!;
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
});

Deno.test('buildNavGraph: jump arc clears a single-column wall (v20.1 parabola check)', () => {
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
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  const fromSpawn = g.edges.get(stateKey(1, 1, 0, 'L'))!;
  const jumps = fromSpawn.filter((e) => e.kind === 'jump');
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
});

Deno.test('buildNavGraph: spawn-cell node + edge map non-empty for trivial level', () => {
  // The smoke case: a 3-col flat level should yield nodes + edges.
  // v26 M4 + v27 M4: each cell expands to 3 vxBuckets × 3
  // xOffsetBuckets = 9 variants → 27 nodes for a 3-cell level.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  assert(g.nodes.size >= 27); // 3 cells × 9 (vx × xOffset) buckets
  assert(g.edges.get(stateKey(1, 1, 0, 'L'))!.length > 0);
});

// --- v25 M1: edges carry endState ------------------------------------
// (ported from apps/editor/e2e/v25-edge-state.spec.ts)

Deno.test('v25 M1: buildNavGraph edges carry endState', () => {
  const parsed = parse('# size: 6x4\n######\n#P..E#\n######');
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // v26 M4 + v27 M4: graph keys are stateKey (cell × vxBucket ×
  // xOffsetBucket). Spawn-grounded default is bucket (0, 'L').
  assert(g.start, 'expected a spawn cell');
  const edges = g.edges.get(`${g.start.r},${g.start.c},0,L`) ?? [];
  // Sample at least one edge; assert endState shape.
  assert(edges.length > 0, 'no edges');
  const e = edges[0];
  assert(e.endState, 'expected endState');
  assertEquals(Object.keys(e.endState).sort(), ['onGround', 'vx', 'vy', 'x', 'y']);
  assert(Math.abs(e.endState.x - e.endPos.x) < 0.01);
  assert(Math.abs(e.endState.y - e.endPos.y) < 0.01);
});

// --- v25 M4: precision-landing edges ---------------------------------
// (ported from apps/editor/e2e/v25-precision-landing.spec.ts)

Deno.test('v25 M4: grid emits precision edges that pass ±2 px target centres', () => {
  // Level: P on row 5 col 2. Pickup `o` at row 3 col 7 with walls
  // around forcing precision landing.
  const parsed = parse([
    '# size: 12x7',
    '############',
    '#..........#',
    '#..........#',
    '#......o...#',
    '#..........#',
    '#.P......E.#',
    '############',
  ].join('\n'));
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // Count edges flagged precision (the rule fired).
  let totalPrecisionEdges = 0;
  for (const edges of g.edges.values()) {
    for (const e of edges) {
      if (e.precision) totalPrecisionEdges++;
    }
  }
  assertEquals(g.pickupCells.length, 1);
  // For any normal jump arc that crosses near a target, expect at
  // least ONE precision edge.
  assert(totalPrecisionEdges > 0);
});

// --- v26 M4 + v27 M4: state-space node identity -----------------------
// (ported from apps/editor/e2e/v26-bucket-graph.spec.ts and
// v27-bucket-graph.spec.ts)

Deno.test('v26 M4 + v27 M4: graph node count = walkable-cells × 9 (vx × xOffset variants)', () => {
  // v26 shipped 3 vxBucket variants per cell; v27 M4 extends each to
  // 3 xOffsetBucket variants for sub-cell x discretisation.
  const parsed = parse('#####\n#P.E#\n#####');
  const g = buildNavGraph(jsAdapter, parsed, DEFAULT_LEGEND);
  // 3 walkable cells × 9 (vx × xOffset) buckets = 27 nodes.
  assertEquals(g.nodes.size, 27);
  // Every node key has the four-part stateKey shape.
  for (const k of g.edges.keys()) {
    assertEquals(k.split(',').length, 4);
  }
});

Deno.test('v26 M4 + v27 M4: stateKey + vxBucketOf + parseStateKey helpers', () => {
  assertEquals(stateKey(5, 7, 0, 'L'), '5,7,0,L');
  assertEquals(stateKey(5, 7, -1, 'L'), '5,7,-1,L');
  assertEquals(stateKey(5, 7, +1, 'L'), '5,7,1,L');
  assertEquals(vxBucketOf(0), 0);
  assertEquals(vxBucketOf(-240), -1);
  assertEquals(vxBucketOf(+240), 1);
  assertEquals(vxBucketOf(15), 0); // |vx| < 30 → still
  assertEquals(parseStateKey('5,7,1,L'), { r: 5, c: 7, vxBucket: 1, xOffsetBucket: 'L' });
  assertEquals(VX_BUCKETS, [-1, 0, 1]);
});

Deno.test('v27 M4: xOffsetBucketOf splits a cell into L/C/R thirds', () => {
  const TILE = 20;
  assertEquals(xOffsetBucketOf(0), 'L');
  assertEquals(xOffsetBucketOf(TILE / 6), 'L');
  assertEquals(xOffsetBucketOf(TILE / 3 - 0.01), 'L');
  assertEquals(xOffsetBucketOf(TILE / 3), 'C');
  assertEquals(xOffsetBucketOf(TILE / 2), 'C');
  assertEquals(xOffsetBucketOf((2 * TILE) / 3 - 0.01), 'C');
  assertEquals(xOffsetBucketOf((2 * TILE) / 3), 'R');
  assertEquals(xOffsetBucketOf(TILE - 0.01), 'R');
  // Wrap into next cell — sub-pixel should reset.
  assertEquals(xOffsetBucketOf(TILE), 'L');
  assertEquals(xOffsetBucketOf(TILE + 1), 'L');
  assertEquals(X_OFFSET_BUCKETS, ['L', 'C', 'R']);
});

Deno.test('v27 M4: stateKey is 4-part; parseStateKey round-trips', () => {
  assertEquals(stateKey(5, 7), '5,7,0,L');
  assertEquals(stateKey(5, 7, -1, 'R'), '5,7,-1,R');
  assertEquals(parseStateKey('5,7,1,C'), { r: 5, c: 7, vxBucket: 1, xOffsetBucket: 'C' });
  assertEquals(stateKey(5, 7, 0, 'L').split(',').length, 4);
});

Deno.test('v27 M4: bucketCentreX picks bucket representatives within their thirds', () => {
  const c = 5;
  const lx = bucketCentreX(c, 'L');
  const cx = bucketCentreX(c, 'C');
  const rx = bucketCentreX(c, 'R');
  // Each representative must land in its own bucket — a round-trip check.
  assertEquals(xOffsetBucketOf(lx), 'L');
  assertEquals(xOffsetBucketOf(cx), 'C');
  assertEquals(xOffsetBucketOf(rx), 'R');
  // L bucket maps to the cell-left edge (sub-pixel 0) so v26
  // bucket-0 behaviour stays byte-identical.
  assertEquals(lx, 5 * 20);
});
