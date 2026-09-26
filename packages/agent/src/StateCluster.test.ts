import { assert, assertEquals, assertFalse } from '@std/assert';
import { StateCluster } from './StateCluster.ts';

// The per-frame A*'s visited / cost-known identity is the cluster key:
// nearby exact states share a key, so the search doesn't explode, while
// staying precise enough that a chain never drifts across a boundary.

Deno.test('identical states cluster identically', () => {
  const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const b = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const ka = StateCluster.keyOf(a);
  assertEquals(ka, StateCluster.keyOf(b));
  // Key is a stable string with 5 comma-separated parts.
  assertEquals(ka.split(',').length, 5);
});

Deno.test('sub-tolerance Δ on any axis clusters identically', () => {
  const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  assert(StateCluster.nearby(base, { ...base, x: 100.24 })); // < 0.5 / 2 of x tol
  assert(StateCluster.nearby(base, { ...base, y: 50.24 }));
  assert(StateCluster.nearby(base, { ...base, vx: 2.4 })); // < 5 / 2 of vx tol
  assert(StateCluster.nearby(base, { ...base, vy: 2.4 }));
  // Same key string for the all-jitter version.
  assertEquals(StateCluster.keyOf({ ...base, x: 100.24, y: 50.24, vx: 2.4, vy: 2.4 }), StateCluster.keyOf(base));
});

Deno.test('above-tolerance Δ clusters distinctly', () => {
  const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  assertFalse(StateCluster.nearby(base, { ...base, x: 101 })); // 1 px > 0.5 tol
  assertFalse(StateCluster.nearby(base, { ...base, y: 51 }));
  assertFalse(StateCluster.nearby(base, { ...base, vx: 8 })); // 8 > 5 vx tol
  assertFalse(StateCluster.nearby(base, { ...base, vy: 8 }));
});

Deno.test('onGround flip breaks clustering (no tolerance on the bool)', () => {
  const grounded = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const airborne = { x: 100, y: 50, vx: 0, vy: 0, onGround: false };
  assertFalse(StateCluster.nearby(grounded, airborne));
});

Deno.test('custom tolerance changes the equivalence class', () => {
  // Rounding boundary is at half-tol (100/0.5 = 200; 100.25/0.5 = 200.5
  // rounds to 201). A diff of 0.2 px keeps the same cluster under
  // default tol (0.5) but flips under a tighter tol (0.1, half-tol
  // = 0.05). A 20-px diff joins under a 50-px tol.
  const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
  const b = { x: 100.2, y: 50, vx: 0, vy: 0, onGround: true };
  assert(StateCluster.nearby(a, b)); // 0.2 < 0.25 half-tol → same
  assertFalse(StateCluster.nearby(a, b, { x: 0.1, y: 0.5, vx: 5, vy: 5 })); // 0.2 > 0.05 half-tol → diff
  assert(StateCluster.nearby({ ...a, x: 90 }, { ...a, x: 110 }, { x: 50, y: 50, vx: 5, vy: 5 }));
});

Deno.test('DEFAULT_TOLERANCE is half a pixel and 5 px/s, and frozen', () => {
  assertEquals({ ...StateCluster.DEFAULT_TOLERANCE }, { x: 0.5, y: 0.5, vx: 5, vy: 5 });
  assert(Object.isFrozen(StateCluster.DEFAULT_TOLERANCE));
});
