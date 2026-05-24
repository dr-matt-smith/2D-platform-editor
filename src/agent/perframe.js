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

// ---- expandNode: on-demand edge generation -------------------------

import { TILE } from '../play/constants.js';
import { enumerateActions, actionToRecording } from './actions.js';
import { makeSimContext, simulateActionInContext } from './simAction.js';
import {
  inBounds,
  isWalkable,
  isGrounded,
  findOverlappingExit,
} from './grid.js';

/**
 * Build a fresh sim-context cache. Pass this to expandNode across
 * all calls within a single plan() invocation so the underlying
 * PlaytestScene is created exactly once per (parsed, legend,
 * tileset) tuple. The cache is keyed by parsed object identity.
 */
export function makeContextCache() {
  return new Map();
}

function getContext(cache, parsed, legend, tileset) {
  let ctx = cache.get(parsed);
  if (!ctx) {
    ctx = makeSimContext(parsed, legend, tileset);
    cache.set(parsed, ctx);
  }
  return ctx;
}

/**
 * Generate every reachable edge from the exact `state` on the level
 * `parsed`. Runs each of the 46 actions through simulateAction;
 * keeps the ones that land on a walkable cell (and grounded for
 * non-win edges); also emits precision-landing edges to 1-tile
 * pickup/exit targets the trajectory passes ±2 px of during
 * descent (v25 M4 rule, lifted from grid.js#addActionEdges).
 *
 * Edges carry the destination as BOTH a cell `{r, c}` (for A*
 * heuristic + goal-prefix matching) and the full exactState (for
 * the next leg's seed). No bucketing.
 *
 * @param {Map} cache              from makeContextCache()
 * @param {object} parsed          level.parse() result
 * @param {object|null} legend     active tileset legend
 * @param {object|null} tileset    active tileset object (or null)
 * @param {{x,y,vx,vy,onGround}} state  exact start state
 * @param {object} [opts]
 * @param {Array<{r,c}>} [opts.exitCells]          for win-edge detection
 * @param {Array<{r,c}>} [opts.precisionTargets]   for precision-landing rule
 * @returns Array<edge>
 */
export function expandNode(cache, parsed, legend, tileset, state, opts = {}) {
  const ctx = getContext(cache, parsed, legend, tileset);
  const exitCells = opts.exitCells ?? [];
  const precisionTargets = opts.precisionTargets ?? [];
  const wantsTrajectory = precisionTargets.length > 0;
  const edges = [];

  for (const action of enumerateActions()) {
    const result = simulateActionInContext(ctx, state, action, {
      collectTrajectory: wantsTrajectory,
    });

    let targetR = result.endCell.r;
    let targetC = result.endCell.c;
    let isWinEdge = false;

    if (result.outcome === 'won') {
      const exit = findOverlappingExit(result.endPos, exitCells);
      if (exit) {
        targetR = exit.r;
        targetC = exit.c;
        isWinEdge = true;
      }
    } else if (result.outcome !== 'ok') {
      continue;
    }

    if (result.collided) continue;
    if (!inBounds(parsed.grid, targetR, targetC)) continue;
    if (!isWalkable(parsed.grid, targetR, targetC)) continue;
    if (!isWinEdge && !isGrounded(parsed.grid, targetR, targetC)) continue;

    edges.push({
      toCell: { r: targetR, c: targetC },
      toState: result.endState,
      kind: action.kind,
      cost: result.cost,
      dir: action.params.dir,
      action,
      recording: actionToRecording(action, 0),
      endPos: result.endPos,
      endVel: result.endVel,
      endState: result.endState,
      isWinEdge,
    });

    // v25 M4 precision-landing rule, copied across to per-frame
    // (no bucketing on the precision edge's destination — toState
    // is the live endState).
    if (result.trajectory && result.outcome === 'ok') {
      for (const t of precisionTargets) {
        const tcx = t.c * TILE + TILE / 2;
        const tcy = t.r * TILE + TILE / 2;
        if (t.r === targetR && t.c === targetC) continue;
        if (t.r === Math.floor((state.y + TILE / 2) / TILE) &&
            t.c === Math.floor((state.x + TILE / 2) / TILE)) continue;
        let prevY = state.y;
        for (const pt of result.trajectory) {
          const pcx = pt.x + TILE / 2;
          const pcy = pt.y + TILE / 2;
          const descending = pt.y > prevY;
          if (descending && Math.abs(pcx - tcx) <= 2 && Math.abs(pcy - tcy) <= 2) {
            edges.push({
              toCell: { r: t.r, c: t.c },
              toState: result.endState,
              kind: action.kind,
              cost: result.cost,
              dir: action.params.dir,
              action,
              recording: actionToRecording(action, 0),
              endPos: result.endPos,
              endVel: result.endVel,
              endState: result.endState,
              isWinEdge: false,
              precision: true,
            });
            break;
          }
          prevY = pt.y;
        }
      }
    }
  }
  return edges;
}
