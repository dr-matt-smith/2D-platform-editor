import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { ActionKind } from './ActionKind.ts';
import { Direction } from './Direction.ts';
import { JUMP_MAX_HORIZ_CELLS, JUMP_MAX_VERT_CELLS } from './constants.ts';
import { NavGraph } from './NavGraph.ts';
import { StateKey } from './StateKey.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const key = (r: number, c: number) => StateKey.of(r, c).toString();

// --- physics constants are exposed as reach envelope --------------

Deno.test('jump reach envelope: derived from physics — ~8 horizontal, ~4 vertical', () => {
  // With SPEED=240, JUMP_FORCE=560, GRAVITY=1600, TILE=20:
  //   horiz = floor(SPEED * 2*JUMP_FORCE/GRAVITY / TILE) = floor(168/20) = 8
  //   vert  = floor(JUMP_FORCE^2 / (2*GRAVITY) / TILE)   = floor(98/20)  = 4
  assertEquals(JUMP_MAX_HORIZ_CELLS, 8);
  assertEquals(JUMP_MAX_VERT_CELLS, 4);
});

// --- NavGraph.build: start / pickups / exit extraction ----------

Deno.test('NavGraph.build: locates P spawn (settled) + E + pickups', () => {
  // P high above the floor; spawn settles to (3, 1).
  const text = '#####\n#P..#\n#...#\n#.oE#\n#####';
  const g = NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);
  assertEquals(g.start, { r: 3, c: 1 });
  assertEquals(g.pickupCells, [{ r: 3, c: 2 }]);
  assertEquals(g.exitCells, [{ r: 3, c: 3 }]);
});

// Tests assert by cell rather than by full state: the speed bucket
// may legitimately vary with the action.
const cellOf = (stateK: string) => stateK.split(',').slice(0, 2).join(',');

Deno.test('NavGraph.build: walk edges between adjacent grounded cells', () => {
  // Flat 5-wide floor, player + exit on row 1.
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  // From the middle cell (1, 2): walk edges to (1, 1) and (1, 3).
  const walks = g.edgesFrom(key(1, 2)).filter((e) => e.kind === ActionKind.Walk);
  const targets = [...new Set(walks.map((e) => cellOf(e.to)))].sort();
  assertEquals(targets, ['1,1', '1,3']);
});

Deno.test('NavGraph.build: hazard cells produce no walk edges to/from', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.^E#\n#####'), DEFAULT_LEGEND);
  // The hazard cell isn't a node under any bucket.
  assertEquals(g.hasNode(key(1, 3)), false);
  // From (1, 2), no edge to any (1, 3, *) state.
  const cellTargets = g.edgesFrom(key(1, 2)).map((e) => cellOf(e.to));
  assertEquals(cellTargets.includes('1,3'), false);
});

Deno.test('NavGraph.build: drop edge off a ledge to lower platform', () => {
  const text = [
    '##........',
    '##........',
    '#P........',
    '###.......', // floor at row 3 cols 0-2; cells 3+ open
    '...#######', // floor at row 4 cols 3-9
  ].join('\n');
  const g = NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);
  // From (2, 2): drop right walks off the ledge and lands on the lower
  // platform. A drop holds its direction for the whole fall, so it drifts
  // right; only check that some drop edge lands on row 3 (whose AABB
  // centre sits on top of the row-4 floor).
  const drops = g.edgesFrom(key(2, 2)).filter((e) => e.kind === ActionKind.Drop);
  assert(drops.length > 0, 'expected at least one drop edge');
  const rightDrops = drops.filter((d) => d.dir === Direction.Right);
  assert(rightDrops.length > 0);
  assert(rightDrops[0].to.startsWith('3,'), `expected row 3, got ${rightDrops[0].to}`);
});

Deno.test('NavGraph.build: jump edge between two platforms across a gap', () => {
  const text = [
    '.........',
    '#P....E.#',
    '##....###',
    '.........',
    '#########',
  ].join('\n');
  const g = NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);
  // From the spawn (1, 1): a jump reaches across the gap to (1, 6).
  const jumps = g.edgesFrom(key(1, 1)).filter((e) => e.kind === ActionKind.Jump);
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
});

Deno.test('NavGraph.build: jump arc clears a single-column wall', () => {
  // A straight line from (1, 1) to (1, 6) crosses the wall at (1, 4), but
  // the simulated arc goes high enough to clear it.
  const text = [
    '.........',
    '#P..#.E.#',
    '##..#.###',
    '.........',
    '#########',
  ].join('\n');
  const g = NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);
  const jumps = g.edgesFrom(key(1, 1)).filter((e) => e.kind === ActionKind.Jump);
  const reachableCells = jumps.map((e) => cellOf(e.to));
  assert(reachableCells.includes('1,6'), `jumps: ${reachableCells.join(', ')}`);
});

Deno.test('NavGraph.build: spawn-cell node + edge map non-empty for trivial level', () => {
  // Each cell expands to 3 speed × 3 x-offset buckets → 27 nodes for 3 cells.
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assert(g.nodes.size >= 27);
  assert(g.edgesFrom(key(1, 1)).length > 0);
});

Deno.test('NavGraph.build: a level with no spawn gets nodes but no edges', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#..E#\n#####'), DEFAULT_LEGEND);
  assertEquals(g.nodes.size, 27);
  assertEquals([...g.edges.values()].every((es) => es.length === 0), true);
  assertEquals(g.start, null);
});

// --- edges carry endState --------------------------------------------

Deno.test('NavGraph.build: edges carry endState', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('# size: 6x4\n######\n#P..E#\n######'), DEFAULT_LEGEND);
  assert(g.start, 'expected a spawn cell');
  const edges = g.edgesFrom(`${g.start.r},${g.start.c},0,L`);
  assert(edges.length > 0, 'no edges');
  const e = edges[0];
  assert(e.endState, 'expected endState');
  assertEquals(Object.keys(e.endState).sort(), ['onGround', 'vx', 'vy', 'x', 'y']);
  assert(Math.abs(e.endState.x - e.endPos.x) < 0.01);
  assert(Math.abs(e.endState.y - e.endPos.y) < 0.01);
});

// --- precision-landing edges -----------------------------------------

Deno.test('NavGraph.build: precision edges to targets an arc passes within 2 px of', () => {
  const parsed = Level.parse([
    '# size: 12x7',
    '############',
    '#..........#',
    '#..........#',
    '#......o...#',
    '#..........#',
    '#.P......E.#',
    '############',
  ].join('\n'));
  const g = NavGraph.build(jsAdapter, parsed, DEFAULT_LEGEND);
  let totalPrecisionEdges = 0;
  for (const edges of g.edges.values()) {
    for (const e of edges) {
      if (e.precision) totalPrecisionEdges++;
    }
  }
  assertEquals(g.pickupCells.length, 1);
  // Some jump arc crosses near the pickup.
  assert(totalPrecisionEdges > 0);
});

// --- state-space node identity ----------------------------------------

Deno.test('NavGraph.build: node count = walkable cells × 9 (speed × x-offset buckets)', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assertEquals(g.nodes.size, 27);
  for (const k of g.edges.keys()) {
    assertEquals(k.split(',').length, 4);
  }
});

// --- findPath (A*) ------------------------------------------------------

Deno.test('findPath: finds a path on a flat level', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  // `from` is a StateKey; `to` is a cell key and any bucket there matches.
  const path = g.findPath('1,1,0,L', '1,3');
  assert(path);
  // A walk chain or a single edge that wins on touching the exit — either is fine.
  assert(path.length >= 1, 'expected non-empty path');
});

Deno.test('findPath: returns null when destination unreachable', () => {
  // Disconnected tiny platforms; the 9-cell gap is beyond jump reach.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const g = NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);
  const path = g.findPath('1,1,0,L', '1,10');
  assertEquals(path, null, `expected null path, got ${path && path.length} edges`);
});

Deno.test('findPath: same start + end returns empty path', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assertEquals(g.findPath('1,1,0,L', '1,1'), []);
});

Deno.test('findPath: finds a path through state-space nodes on a wider level', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('############\n#P........E#\n############'), DEFAULT_LEGEND);
  const path = g.findPath('1,1,0,L', '1,10');
  assert(path && path.length > 0);
});

Deno.test('findPath: an unknown start node has no path', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assertEquals(g.findPath('9,9,0,L', '1,3'), null);
});

Deno.test('findPath: blocked edges are avoided', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('############\n#P........E#\n############'), DEFAULT_LEGEND);
  const path = g.findPath('1,1,0,L', '1,10')!;
  const first = `${path[0].from}>${path[0].edge.to}:${path[0].edge.kind}`;
  const detour = g.findPath('1,1,0,L', '1,10', new Set([first]))!;
  assert(detour.length > 0);
  assert(detour.every((s) => `${s.from}>${s.edge.to}:${s.edge.kind}` !== first));
});

Deno.test('NavGraph.pathCost sums the edge costs', () => {
  const g = NavGraph.build(jsAdapter, Level.parse('############\n#P........E#\n############'), DEFAULT_LEGEND);
  const path = g.findPath('1,1,0,L', '1,10')!;
  assertEquals(NavGraph.pathCost(path), path.reduce((s, step) => s + step.edge.cost, 0));
  assertEquals(NavGraph.pathCost([]), 0);
});
