// v28 per-frame trajectory planner. The architectural successor to
// v26/v27's bucket-aware A*. Where the bucket graph carved each cell
// into a small discrete set of (vxBucket, xOffsetBucket) variants —
// and ran into chain-fragility when the live engine's sub-pixel
// drift crossed bucket boundaries (v27 transcript §M5) — the per-
// frame planner doesn't bucket at all. A* nodes carry the FULL
// continuous-physics exactState; edges are produced on-the-fly by
// simulating actions from that exact state. The chain is exact by
// construction.
//
// This module exports the equivalence-class helpers used by the
// A*'s "visited / cost-known" lookups (next milestone wires them
// into a real planner). Two nearby exactStates cluster to the same
// key so the search doesn't explode; tolerances are tunable.

/**
 * Tolerances for the equivalence-class lookup. Two exactStates whose
 * scalars round to the same bucket under these tolerances are
 * treated as the same A* node for visited / gScore purposes.
 *
 *   x, y    — px (player AABB top-left)
 *   vx, vy  — px/s
 *
 * Same-onGround is enforced strictly (no tolerance) because the
 * physics branches sharply on it (gravity vs collision).
 */
export const DEFAULT_CLUSTER_TOL = Object.freeze({
  x: 0.5,
  y: 0.5,
  vx: 5,
  vy: 5,
});

/**
 * Compute the cluster key for an exactState. Each scalar is rounded
 * to its tolerance bucket and the five rounded ints are joined into
 * a stable string. Same input → same output (pure).
 *
 * @param {{x:number, y:number, vx:number, vy:number, onGround:boolean}} state
 * @param {{x:number, y:number, vx:number, vy:number}} [tol]
 * @returns {string}
 */
export function clusterKey(state, tol = DEFAULT_CLUSTER_TOL) {
  const cx = Math.round(state.x / tol.x);
  const cy = Math.round(state.y / tol.y);
  const cvx = Math.round(state.vx / tol.vx);
  const cvy = Math.round(state.vy / tol.vy);
  return `${cx},${cy},${cvx},${cvy},${state.onGround ? 1 : 0}`;
}

/**
 * True when two states fall in the same equivalence class — i.e.,
 * their cluster keys match. Convenience over `clusterKey(a) ===
 * clusterKey(b)`.
 */
export function nearby(a, b, tol = DEFAULT_CLUSTER_TOL) {
  return clusterKey(a, tol) === clusterKey(b, tol);
}
