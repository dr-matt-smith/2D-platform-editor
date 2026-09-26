import { assert, assertEquals, assertFalse, assertStrictEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { JsPhysicsAdapter, jsAdapter } from '@2d-platform/engine';
import { ActionKind } from './ActionKind.ts';
import { Direction } from './Direction.ts';
import { PerFrameExpander } from './PerFrameExpander.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const TILE = 20;

// Given an exact state, expand() returns every reachable next state via
// the 46 actions. Edges carry the destination as both a cell {r, c} and
// the live end state. No bucketing.

Deno.test('expand from spawn on flat level yields walks + win-edges', () => {
  // P at col 2, so col 1 (.) is open for a walk left.
  const parsed = Level.parse('######\n#.P.E#\n######');
  const expander = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, {
    exitCells: [{ r: 1, c: 4 }],
  });
  const edges = expander.expand({ x: 2 * TILE, y: 1 * TILE, vx: 0, vy: 0, onGround: true });
  assert(edges.length > 0);
  const walkDirs = edges.filter((e) => e.kind === ActionKind.Walk).map((e) => e.dir).sort();
  assert(walkDirs.includes(Direction.Left));
  assert(walkDirs.includes(Direction.Right));
  // The exit is 2 cells right of spawn; jumps + walks may reach it.
  assert(edges.some((e) => e.isWinEdge));
  assert(edges.every((e) =>
    e.toCell && typeof e.toCell.r === 'number' &&
    typeof e.toCell.c === 'number' && e.toState &&
    typeof e.toState.x === 'number' && typeof e.toState.y === 'number'
  ));
  const walkRight = edges.find((e) => e.kind === ActionKind.Walk && e.dir === Direction.Right);
  assertEquals(walkRight?.cost, 5);
});

Deno.test('expand results are deterministic across calls', () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const expander = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, {
    exitCells: [{ r: 1, c: 3 }],
  });
  const state = { x: 20, y: 20, vx: 0, vy: 0, onGround: true };
  const e1 = expander.expand(state);
  const e2 = expander.expand(state);
  // End states are bit-equal across calls (pure physics integration).
  assertEquals(e1.length, e2.length);
  assert(e1[0].endState.x === e2[0].endState.x && e1[0].endState.y === e2[0].endState.y);
});

Deno.test('edge.toState is the exact endState (no bucketing)', () => {
  const parsed = Level.parse('##########\n#P......E#\n##########');
  const expander = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, {
    exitCells: [{ r: 1, c: 8 }],
  });
  const state = { x: TILE, y: TILE, vx: 0, vy: 0, onGround: true };
  const walkR = expander.expand(state).find((e) => e.kind === ActionKind.Walk && e.dir === Direction.Right);
  assert(walkR, 'expected a walk_right edge');
  const endCellC = Math.floor((walkR.endState.x + TILE / 2) / TILE);
  assertStrictEquals(walkR.toState, walkR.endState);
  assertEquals(endCellC, walkR.toCell.c);
  assert(walkR.endState.x > state.x);
});

// Counts the scenes it is asked to make.
class CountingAdapter extends JsPhysicsAdapter {
  scenesMade = 0;
  override makeScene(...args: Parameters<JsPhysicsAdapter['makeScene']>) {
    this.scenesMade++;
    return super.makeScene(...args);
  }
}

Deno.test('the scene is built once, lazily, and reused across expansions', () => {
  // Building a scene is the expensive part; a leg expands many states.
  const adapter = new CountingAdapter();
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const expander = new PerFrameExpander(adapter, parsed, DEFAULT_LEGEND);
  assertFalse(expander.hasScene);
  assertEquals(adapter.scenesMade, 0);
  expander.expand({ x: 20, y: 20, vx: 0, vy: 0, onGround: true });
  expander.expand({ x: 40, y: 20, vx: 0, vy: 0, onGround: true });
  assertEquals(adapter.scenesMade, 1);
  assert(expander.hasScene);
});

Deno.test('precision targets add precision edges', () => {
  // From (5, 3) one jump arc passes through the pickup at (3, 7).
  const parsed = Level.parse([
    '############',
    '#..........#',
    '#..........#',
    '#......o...#',
    '#..........#',
    '#.P......E.#',
    '############',
  ].join('\n'));
  const targets = {
    exitCells: [{ r: 5, c: 9 }],
    precisionTargets: [{ r: 3, c: 7 }, { r: 5, c: 9 }],
  };
  const state = { x: 3 * TILE, y: 5 * TILE, vx: 0, vy: 0, onGround: true };
  const edges = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, targets).expand(state);
  const precision = edges.filter((e) => e.precision);
  assertEquals(precision.length, 1);
  assertEquals(precision[0].toCell, { r: 3, c: 7 });
  assertFalse(precision[0].isWinEdge);
  // Without targets, no precision edges.
  const plain = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, { exitCells: targets.exitCells });
  assertEquals(plain.expand(state).filter((e) => e.precision).length, 0);
});
