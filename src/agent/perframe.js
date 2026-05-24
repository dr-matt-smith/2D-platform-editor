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
import { WALK_FRAMES_PER_CELL, DROP_HOLD_FRAMES_BUDGET, enumerateActions, actionToRecording } from './actions.js';
import { makeSimContext, simulateActionInContext } from './simAction.js';
import {
  inBounds,
  isWalkable,
  isGrounded,
  settle,
  findOverlappingExit,
  cellKey,
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

// ---- Goal discovery + per-frame A* ---------------------------------

/**
 * Locate the spawn (settled), pickup cells, and exit cells without
 * building the bucket-aware nav-graph. Skipping the 46-action sweep
 * keeps this O(rows × cols).
 */
export function discoverGoals(parsed, legend) {
  const grid = parsed.grid;
  let pSpawn = null;
  const pickupCells = [];
  const exitCells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!isWalkable(grid, r, c)) continue;
      const ch = grid[r][c];
      if (ch === 'P') pSpawn = { r, c };
      else if (ch === 'E') exitCells.push({ r, c });
      else if (legend?.[ch]?.role === 'pickup' || ch === 'o') pickupCells.push({ r, c });
    }
  }
  const start = pSpawn ? settle(grid, pSpawn.r, pSpawn.c) : null;
  return { start, pickupCells, exitCells, pSpawn };
}

/**
 * Heuristic for A*: Manhattan cell distance × WALK_FRAMES_PER_CELL.
 * Admissible — the player needs at least 1 walk-frame per cell of
 * traversal (jumps/drops are at most equally efficient).
 */
function heuristic(rA, cA, rB, cB) {
  return (Math.abs(rA - rB) + Math.abs(cA - cB)) * WALK_FRAMES_PER_CELL;
}

/**
 * Deterministic tie-break for edges with equal f-score. Lex-sort
 * by (kind, dir, jump-holdFrames, drop-releaseFrame, walkCells).
 * Stops two runs from picking different equally-optimal edges.
 */
function edgeSortKey(edge) {
  const a = edge.action ?? {};
  const p = a.params ?? {};
  return [
    a.kind ?? '',
    p.dir ?? '',
    String(p.holdFrames ?? ''),
    String(p.releaseFrame ?? ''),
    String(p.walkCells ?? ''),
  ].join('|');
}

const DEFAULT_NODE_CAP = 100_000;

/**
 * Per-frame A* from `fromState` to any cell matching `goalCellKey`
 * ("r,c"). Returns an array of `{ from, edge, fromState }` steps
 * (compatible with planner.js#emitLegInputs) or null on failure.
 *
 * @param {object} parsed
 * @param {object|null} legend
 * @param {object|null} tileset
 * @param {{x,y,vx,vy,onGround}} fromState
 * @param {string} goalCellKey       "r,c"
 * @param {object} opts
 * @param {Array<{r,c}>} [opts.exitCells]
 * @param {Array<{r,c}>} [opts.precisionTargets]
 * @param {Map} [opts.cache]         from makeContextCache()
 * @param {object} [opts.tol]
 * @param {number} [opts.nodeCap=100k]
 */
export function aStarPerFrame(parsed, legend, tileset, fromState, goalCellKey, opts = {}) {
  const cache = opts.cache ?? makeContextCache();
  const exitCells = opts.exitCells ?? [];
  const precisionTargets = opts.precisionTargets ?? [];
  const tol = opts.tol ?? DEFAULT_CLUSTER_TOL;
  const nodeCap = opts.nodeCap ?? DEFAULT_NODE_CAP;

  const [tr, tc] = goalCellKey.split(',').map(Number);
  const matchesGoal = (cellR, cellC) => cellR === tr && cellC === tc;

  const fromR = Math.floor((fromState.y + TILE / 2) / TILE);
  const fromC = Math.floor((fromState.x + TILE / 2) / TILE);
  if (matchesGoal(fromR, fromC)) return [];

  const startCK = clusterKey(fromState, tol);
  const open = new Map();   // ck → {state, cellR, cellC}
  open.set(startCK, { state: fromState, cellR: fromR, cellC: fromC });
  const gScore = new Map([[startCK, 0]]);
  const fScore = new Map([[startCK, heuristic(fromR, fromC, tr, tc)]]);
  const cameFrom = new Map(); // ck → {from: prevCK, edge, fromState}

  let expanded = 0;
  while (open.size > 0 && expanded < nodeCap) {
    // Pick lowest f-score from open.
    let curCK = null;
    let curBest = Infinity;
    for (const ck of open.keys()) {
      const f = fScore.get(ck) ?? Infinity;
      if (f < curBest) { curBest = f; curCK = ck; }
    }
    const curNode = open.get(curCK);
    open.delete(curCK);
    expanded++;

    if (matchesGoal(curNode.cellR, curNode.cellC)) {
      // Reconstruct.
      const path = [];
      let ck = curCK;
      while (cameFrom.has(ck)) {
        const { from, edge, fromState: legStart } = cameFrom.get(ck);
        path.unshift({ from, edge, fromState: legStart });
        ck = from;
      }
      return path;
    }

    // Expand.
    const edges = expandNode(cache, parsed, legend, tileset, curNode.state, {
      exitCells, precisionTargets,
    });
    // Deterministic order so tie-breaking is stable.
    edges.sort((a, b) => edgeSortKey(a).localeCompare(edgeSortKey(b)));

    const curG = gScore.get(curCK) ?? Infinity;
    for (const edge of edges) {
      const nextCK = clusterKey(edge.toState, tol);
      const tentative = curG + edge.cost;
      if (tentative < (gScore.get(nextCK) ?? Infinity)) {
        cameFrom.set(nextCK, { from: curCK, edge, fromState: curNode.state });
        gScore.set(nextCK, tentative);
        fScore.set(nextCK, tentative + heuristic(edge.toCell.r, edge.toCell.c, tr, tc));
        open.set(nextCK, {
          state: edge.toState,
          cellR: edge.toCell.r,
          cellC: edge.toCell.c,
        });
      }
    }
  }
  return null;
}

/**
 * Top-level per-frame planner. Discovers goals, runs A* per leg,
 * threads the action recording. Mirrors planner.js#plan's contract
 * but does NOT use bucket-aware A*.
 */
export function planPerFrame(parsed, legend, tileset, opts = {}) {
  const { start, pickupCells, exitCells } = discoverGoals(parsed, legend);
  if (!start || exitCells.length === 0) {
    return { trace: [], recording: [], stats: { steps: 0, jumps: 0, walks: 0, drops: 0 }, graph: null, goals: [], unreachable: [] };
  }
  // Reuse v22 resolveGoals via a lazy delegation — exposes shape
  // compatible with `pickupCells`, `exitCells`, `start` (the bits
  // resolveGoals actually reads).
  const stubGraph = {
    pickupCells, exitCells, start,
    width: parsed.meta.width, height: parsed.grid.length,
  };
  // resolveGoals lives in planner.js; importing it would create a
  // cycle, so inline the v22 minimal logic for now: visit every
  // pickup-required in nearest-first order, then exit.
  const pickupRequired = parsed?.meta?.pickupRequired ?? 'all';
  const exitKey = cellKey(exitCells[0].r, exitCells[0].c);
  let need;
  if (pickupRequired === 'all') need = pickupCells.length;
  else if (pickupRequired === 0) need = 0;
  else need = Math.min(pickupRequired, pickupCells.length);

  const goals = [];
  let curState = {
    x: start.c * TILE, y: start.r * TILE, vx: 0, vy: 0, onGround: true,
  };
  // Greedy nearest pickup ordering.
  const remaining = pickupCells.map((p) => cellKey(p.r, p.c));
  for (let i = 0; i < need; i++) {
    let bestKey = null;
    let bestDist = Infinity;
    const [curR, curC] = [
      Math.floor((curState.y + TILE / 2) / TILE),
      Math.floor((curState.x + TILE / 2) / TILE),
    ];
    for (const k of remaining) {
      const [r, c] = k.split(',').map(Number);
      const d = Math.abs(r - curR) + Math.abs(c - curC);
      if (d < bestDist) { bestDist = d; bestKey = k; }
    }
    if (!bestKey) break;
    goals.push(bestKey);
    remaining.splice(remaining.indexOf(bestKey), 1);
    const [r, c] = bestKey.split(',').map(Number);
    curState = { x: c * TILE, y: r * TILE, vx: 0, vy: 0, onGround: true };
  }
  goals.push(exitKey);

  const cache = makeContextCache();
  const ctx = {
    recording: [],
    trace: [],
    stats: { steps: 0, jumps: 0, walks: 0, drops: 0 },
    frame: 1,
    currentDir: null,
    state: {
      x: start.c * TILE, y: start.r * TILE, vx: 0, vy: 0, onGround: true,
    },
    cache,
    parsed, legend, tileset,
    exitCells,
    precisionTargets: [...pickupCells, ...exitCells],
  };

  const unreachable = [];
  for (const goal of goals) {
    const [gr, gc] = goal.split(',').map(Number);
    const path = aStarPerFrame(parsed, legend, tileset, ctx.state, goal, {
      cache, exitCells, precisionTargets: ctx.precisionTargets,
      tol: opts.tol, nodeCap: opts.nodeCap,
    });
    const subgoalName = describeGoal(goal, exitCells, pickupCells);
    if (!path) {
      const isExit = exitCells.some((e) => e.r === gr && e.c === gc);
      if (isExit) {
        return {
          trace: ctx.trace, recording: ctx.recording, stats: ctx.stats,
          graph: stubGraph, goals,
          unreachable: [...unreachable, { r: gr, c: gc, kind: 'exit' }],
        };
      }
      unreachable.push({ r: gr, c: gc, kind: 'pickup' });
      continue;
    }
    emitPerFrameLeg(path, subgoalName, ctx);
  }

  // Final release — drop the last held direction so the player
  // doesn't keep walking past the exit if extra frames run.
  if (ctx.currentDir) {
    ctx.recording.push({ frame: ctx.frame, key: ctx.currentDir, down: false });
    ctx.currentDir = null;
  }
  return {
    trace: ctx.trace,
    recording: ctx.recording,
    stats: ctx.stats,
    graph: stubGraph,
    goals,
    unreachable,
  };
}

/**
 * Append the leg's action recording + trace entries to ctx, threading
 * direction-key + jump-tap semantics from v22. Each step's edge
 * carries `.action` so we know holdFrames / releaseFrame / etc.
 *
 * The chain is EXACT by construction (A*'s edges were simulated from
 * the live exactState), so no reSim is needed — the recording will
 * replay byte-identically. v27 M5's per-leg replan is therefore a
 * no-op here.
 */
/** Describe a goal cellKey for the trace's `why:` strings. Mirrors
 *  planner.js#describeGoal — "exit at (c,r)" or "pickup #N at (c,r)". */
function describeGoal(goalKey, exitCells, pickupCells) {
  const [r, c] = goalKey.split(',').map(Number);
  if (exitCells.some((e) => e.r === r && e.c === c)) {
    return `exit at (${c},${r})`;
  }
  const idx = pickupCells.findIndex((p) => p.r === r && p.c === c);
  if (idx >= 0) return `pickup #${idx + 1} at (${c},${r})`;
  return `target (${c},${r})`;
}

function emitPerFrameLeg(steps, subgoalName, ctx) {
  for (const step of steps) {
    const edge = step.edge;
    const dir = edge.dir;

    if (dir === 'left' || dir === 'right') {
      if (ctx.currentDir !== dir) {
        if (ctx.currentDir) {
          ctx.recording.push({ frame: ctx.frame, key: ctx.currentDir, down: false });
        }
        ctx.recording.push({ frame: ctx.frame, key: dir, down: true });
        ctx.currentDir = dir;
      }
    }

    if (edge.kind === 'jump') {
      ctx.recording.push({ frame: ctx.frame, key: 'space', down: true });
      ctx.recording.push({ frame: ctx.frame + 1, key: 'space', down: false });
      const hf = edge.action?.params?.holdFrames;
      if (hf != null && hf < edge.cost && ctx.currentDir) {
        ctx.recording.push({ frame: ctx.frame + hf, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.jumps++;
    } else if (edge.kind === 'walk') {
      ctx.stats.walks++;
    } else if (edge.kind === 'drop') {
      // v28 M3: simAction's actionToRecording for a drop releases the
      // dir at start + DROP_HOLD_FRAMES_BUDGET. The cost reflects this
      // release in its predicted endState. emit the matching release
      // so the live recording's physics matches A*'s prediction — else
      // chained same-direction legs leave the dir held past the
      // simulator's release frame and the player overshoots.
      const releaseAt = ctx.frame + DROP_HOLD_FRAMES_BUDGET;
      if (ctx.currentDir && releaseAt < ctx.frame + edge.cost) {
        ctx.recording.push({ frame: releaseAt, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.drops++;
    } else if (edge.kind === 'drop_release') {
      const rf = edge.action?.params?.releaseFrame;
      if (rf != null && rf < edge.cost && ctx.currentDir) {
        ctx.recording.push({ frame: ctx.frame + rf, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.drops++;
    } else if (edge.kind === 'run_off') {
      // v28 M3: simAction's actionToRecording releases the dir at
      // start + walkCells*5 + DROP_HOLD_FRAMES_BUDGET. Mirror it.
      const wc = edge.action?.params?.walkCells ?? 0;
      const releaseAt = ctx.frame + wc * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET;
      if (ctx.currentDir && releaseAt < ctx.frame + edge.cost) {
        ctx.recording.push({ frame: releaseAt, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.walks++;
    }

    const startFrame = ctx.frame;
    ctx.frame += edge.cost;
    ctx.trace.push({
      kind: edge.kind,
      target: { r: edge.toCell.r, c: edge.toCell.c },
      why: `${edge.kind} ${edge.dir ?? ''} toward ${subgoalName}`.trim().replace(/\s+/g, ' '),
      frameRange: [startFrame, ctx.frame],
      // edgeId shape mirrors the bucket planner's "from>to:kind" so
      // downstream code (planner.test.js + replan blocked-set) sees a
      // colon-prefixed kind suffix.
      edgeId: `perframe>${edge.toCell.r},${edge.toCell.c}:${edge.kind}`,
    });
    ctx.stats.steps++;
    // Update ctx.state to the live endState — the chain is exact.
    ctx.state = { ...edge.endState };
  }
  // No per-leg final release — currentDir threads across goals so
  // consecutive same-direction legs don't re-press. The whole-plan
  // final release lives in planPerFrame's wrap-up (`finaliseRecording`).
}
