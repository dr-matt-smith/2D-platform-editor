import { assert, assertEquals, assertFalse, assertStrictEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { clusterKey, expandNode, makeContextCache, nearby } from './perframe.ts';

const TILE = 20;

// --- v28 M1: cluster-key helpers ------------------------------------
// The per-frame A*'s "visited / cost-known" identity is the cluster
// key — nearby exactStates collapse to the same key so the search
// doesn't explode while staying accurate enough to never let the chain
// drift across an equivalence-class boundary (see design §3.1).
// (ported from apps/editor/e2e/v28-cluster.spec.ts)

Deno.test('v28 M1: identical states cluster identically', () => {
  const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const b = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const ka = clusterKey(a);
  assertEquals(ka, clusterKey(b));
  // Key is a stable string with 5 comma-separated parts.
  assertEquals(ka.split(',').length, 5);
});

Deno.test('v28 M1: sub-tolerance Δ on any axis clusters identically', () => {
  const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  assert(nearby(base, { ...base, x: 100.24 })); // < 0.5 / 2 of x tol
  assert(nearby(base, { ...base, y: 50.24 }));
  assert(nearby(base, { ...base, vx: 2.4 })); // < 5 / 2 of vx tol
  assert(nearby(base, { ...base, vy: 2.4 }));
  // Same key string for the all-jitter version.
  assertEquals(clusterKey({ ...base, x: 100.24, y: 50.24, vx: 2.4, vy: 2.4 }), clusterKey(base));
});

Deno.test('v28 M1: above-tolerance Δ clusters distinctly', () => {
  const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  assertFalse(nearby(base, { ...base, x: 101 })); // 1 px > 0.5 tol
  assertFalse(nearby(base, { ...base, y: 51 }));
  assertFalse(nearby(base, { ...base, vx: 8 })); // 8 > 5 vx tol
  assertFalse(nearby(base, { ...base, vy: 8 }));
});

Deno.test('v28 M1: onGround flip breaks clustering (no tolerance on the bool)', () => {
  const grounded = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const airborne = { x: 100, y: 50, vx: 0, vy: 0, onGround: false };
  assertFalse(nearby(grounded, airborne));
});

Deno.test('v28 M1: custom tolerance changes the equivalence class', () => {
  // Rounding boundary is at half-tol (100/0.5 = 200; 100.25/0.5 = 200.5
  // rounds to 201). A diff of 0.2 px keeps the same cluster under
  // default tol (0.5) but flips under a tighter tol (0.1, half-tol
  // = 0.05). A 20-px diff joins under a 50-px tol.
  const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const b = { x: 100.2, y: 50, vx: 0, vy: 0, onGround: true };
  assert(nearby(a, b)); // 0.2 < 0.25 half-tol → same
  assertFalse(nearby(a, b, { x: 0.1, y: 0.5, vx: 5, vy: 5 })); // 0.2 > 0.05 half-tol → diff
  // 20 px diff but 50-px tol → same
  assert(nearby({ ...a, x: 90 }, { ...a, x: 110 }, { x: 50, y: 50, vx: 5, vy: 5 }));
});

// --- v28 M2: expandNode — on-demand edge generation -----------------
// Given an exact state on a parsed level, return every reachable
// next-state via the 46 actions. Edges carry the destination as BOTH a
// cell {r, c} and the live endState. No bucketing.
// (ported from apps/editor/e2e/v28-expand.spec.ts)

Deno.test('v28 M2: expandNode from spawn on flat level yields walks + win-edges', () => {
  // Wide enough for walk_left + walk_right to both find a walkable
  // destination cell — P at col 2 so col 1 (.) is open to the left.
  const parsed = parse('######\n#.P.E#\n######');
  const cache = makeContextCache();
  const state = { x: 2 * TILE, y: 1 * TILE, vx: 0, vy: 0, onGround: true };
  const edges = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
    adapter: jsAdapter,
    exitCells: [{ r: 1, c: 4 }],
  });
  assert(edges.length > 0);
  const walkKinds = edges.filter((e) => e.kind === 'walk').map((e) => e.dir).sort();
  assert(walkKinds.includes('left'));
  assert(walkKinds.includes('right'));
  // The exit is 2 cells right of spawn; jumps + walks may reach it.
  assert(edges.some((e) => e.isWinEdge));
  assert(edges.every((e) =>
    e.toCell && typeof e.toCell.r === 'number' &&
    typeof e.toCell.c === 'number' && e.toState &&
    typeof e.toState.x === 'number' && typeof e.toState.y === 'number'
  ));
  const walkRight = edges.find((e) => e.kind === 'walk' && e.dir === 'right');
  assertEquals(walkRight?.cost, 5);
});

Deno.test('v28 M2: expandNode results are deterministic across calls', () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const cache = makeContextCache();
  const state = { x: 20, y: 20, vx: 0, vy: 0, onGround: true };
  const e1 = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
    adapter: jsAdapter,
    exitCells: [{ r: 1, c: 3 }],
  });
  const e2 = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
    adapter: jsAdapter,
    exitCells: [{ r: 1, c: 3 }],
  });
  // endState scalars should be bit-equal across calls (pure physics
  // integration).
  assertEquals(e1.length, e2.length);
  assert(e1[0].endState.x === e2[0].endState.x && e1[0].endState.y === e2[0].endState.y);
});

Deno.test('v28 M2: edge.toState is the exact endState (no bucketing)', () => {
  // Wider level so the player has room to accelerate.
  const parsed = parse('##########\n#P......E#\n##########');
  const cache = makeContextCache();
  const state = { x: TILE, y: TILE, vx: 0, vy: 0, onGround: true };
  const edges = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
    adapter: jsAdapter,
    exitCells: [{ r: 1, c: 8 }],
  });
  // Find a walk_right edge; its endState.x should be > start.x and
  // the cell should match toCell.
  const walkR = edges.find((e) => e.kind === 'walk' && e.dir === 'right');
  assert(walkR, 'expected a walk_right edge');
  const endCellC = Math.floor((walkR.endState.x + TILE / 2) / TILE);
  assertStrictEquals(walkR.toState, walkR.endState);
  assertEquals(endCellC, walkR.toCell.c);
  assert(walkR.endState.x > state.x);
});

Deno.test('v28 M2: makeContextCache caches across multiple expand calls', () => {
  // The simContext is expensive to build (PlaytestScene construction).
  // Two expand calls with the same parsed object MUST reuse the same
  // ctx — otherwise per-leg perf would tank.
  const parsed = parse('#####\n#P.E#\n#####');
  const cache = makeContextCache();
  expandNode(cache, parsed, DEFAULT_LEGEND, null, { x: 20, y: 20, vx: 0, vy: 0, onGround: true }, {
    adapter: jsAdapter,
  });
  expandNode(cache, parsed, DEFAULT_LEGEND, null, { x: 40, y: 20, vx: 0, vy: 0, onGround: true }, {
    adapter: jsAdapter,
  });
  assertEquals(cache.size, 1);
  assert(cache.has(parsed));
});
