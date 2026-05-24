// Planner for the v20 agent. Builds a nav-graph (via grid.js), then runs
// A* between consecutive goals (pickups, exit) to produce:
//
//   - `trace`     — explainable list of { kind, target, why, frameRange }
//   - `recording` — frame-indexed ScriptedInput events derived from the trace
//   - `stats`     — { steps, jumps, walks, drops }
//
// Pure: no DOM, no engine state. The engine's physics constants come in
// through grid.js's reach envelope; everything else is graph traversal.
//
// v20 ships ONE shortest solution per call (greedy nearest-first
// pickup ordering). Multi-solution enumeration is a v21+ candidate;
// `plan()` returns a single-element-friendly shape so v21 grows the
// list without breaking callers.

import { buildNavGraph, cellKey, stateKey, vxBucketOf } from './grid.js';
import { makeSimContext, simulateActionInContext } from './simAction.js';
import { TILE } from '../play/constants.js';

// ---- A* over the nav-graph ---------------------------------------------

/** Manhattan-cell heuristic, weighted by the walk cost so it's
 *  admissible against any edge type. */
function heuristic(fromR, fromC, toR, toC) {
  return (Math.abs(fromR - toR) + Math.abs(fromC - toC)) * 5;
}

function lowestF(open, fScore) {
  let best = null;
  let bestF = Infinity;
  for (const k of open) {
    const f = fScore.get(k) ?? Infinity;
    if (f < bestF) {
      bestF = f;
      best = k;
    }
  }
  return best;
}

/**
 * A* on the nav-graph.
 * @param graph        from `buildNavGraph`
 * @param from         stateKey "r,c,vxBucket" (v26 M4) — the player's
 *                     exact node identity to search from
 * @param to           cellKey "r,c" — match ANY stateKey at that
 *                     cell (any vxBucket arrival is acceptable for
 *                     a pickup / exit goal)
 * @param blocked      optional Set<string> of edge IDs to exclude (replan)
 * @returns Array<{from, edge, cost}> the path, or null if unreachable.
 *
 * v26 M4: A* operates on stateKey nodes (cell × vxBucket). The
 * `from` is a stateKey; the `to` is a CELLKEY — A* succeeds when
 * any stateKey at that cell is reached. Lets the planner pick the
 * vxBucket variant that's cheapest to arrive at without forcing the
 * caller to enumerate them.
 */
export function aStar(graph, from, to, blocked = new Set()) {
  if (!graph.nodes.has(from)) return null;
  // v26: goal-cell match — accept ANY stateKey with prefix `to,`.
  const goalCellPrefix = to + ',';
  const matchesGoal = (k) => k === to || k.startsWith(goalCellPrefix);
  if (matchesGoal(from)) return [];

  const [fr, fc] = from.split(',').map(Number);
  const [tr, tc] = to.split(',').map(Number);

  const open = new Set([from]);
  const cameFrom = new Map(); // node → { from, edge }
  const gScore = new Map([[from, 0]]);
  const fScore = new Map([[from, heuristic(fr, fc, tr, tc)]]);

  while (open.size > 0) {
    const current = lowestF(open, fScore);
    if (matchesGoal(current)) {
      // Reconstruct.
      const path = [];
      let node = current;
      while (cameFrom.has(node)) {
        const { from: prev, edge } = cameFrom.get(node);
        path.unshift({ from: prev, edge });
        node = prev;
      }
      return path;
    }
    open.delete(current);
    const edges = graph.edges.get(current) ?? [];
    for (const edge of edges) {
      // Edge ID = "from→to:kind" so we can blacklist a specific edge
      // by direction + kind (replan precision).
      const edgeId = `${current}>${edge.to}:${edge.kind}`;
      if (blocked.has(edgeId)) continue;
      const tentative = (gScore.get(current) ?? Infinity) + edge.cost;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, { from: current, edge });
        gScore.set(edge.to, tentative);
        const [er, ec] = edge.to.split(',').map(Number);
        fScore.set(edge.to, tentative + heuristic(er, ec, tr, tc));
        open.add(edge.to);
      }
    }
  }
  return null;
}

// ---- Goal queue ---------------------------------------------------------

/**
 * Resolve the goal queue for a level given its pickup-required setting:
 *
 *   - 'all'  → visit every pickup, then the exit.
 *   - 0      → visit the exit directly.
 *   - N      → visit the N pickups in min-total-cost order
 *              (TSP-optimal for N ≤ 4, 2-opt heuristic for N > 4),
 *              then exit.
 *
 * Returns an ordered list of "r,c" goal keys. Pickups are sub-goals;
 * the final entry is always an exit cell. Unreachable pickups are
 * filtered out before ordering — the planner attempts what's reachable
 * and the runner surfaces partial-completability separately.
 *
 * v22: replaces v20/v21's pure greedy nearest-first with a
 * combinatorial-optimal ordering for small K. On `tutorial.txt`'s
 * 4-pickup `oooo` row, greedy would pick the middle pickup first
 * and overshoot; TSP-optimal walks left-to-right end-to-end.
 */
function resolveGoals(graph, requiredPickups) {
  const exitKey = graph.exitCells[0] ? cellKey(graph.exitCells[0].r, graph.exitCells[0].c) : null;
  if (!exitKey) return [];

  const total = graph.pickupCells.length;
  let need;
  if (requiredPickups === 'all' || requiredPickups == null) need = total;
  else if (typeof requiredPickups === 'number' && requiredPickups > 0)
    need = Math.min(requiredPickups, total);
  else need = 0;

  if (need === 0) return [exitKey];

  const startCell = graph.start;
  if (!startCell) return [exitKey];
  // v26 M4 + v27 M4: TSP helpers' aStar(from, to) — `from` is a
  // stateKey (cell × vxBucket × xOffsetBucket). Spawn-grounded
  // start is bucket (0, 'L') — the player settles at x = c*TILE,
  // which falls in the L third. Subsequent legs are estimated from
  // (0, 'L') too because the TSP heuristics don't simulate edge-
  // by-edge (the actual planner loop tracks real-bucket state).
  // Cost estimates are slightly pessimistic but consistent.
  const startKey = stateKey(startCell.r, startCell.c, 0, 'L');
  const allKeys = graph.pickupCells.map((p) => cellKey(p.r, p.c));

  // Drop unreachable pickups (no A* path from start) — the planner
  // can still attempt the exit; the runner reports the rest.
  const reachable = allKeys.filter((k) => aStar(graph, startKey, k) !== null);

  if (reachable.length === 0) return [exitKey];

  // For "need = N of M": enumerate combinations C(M, N). For each
  // combination, find the best ordering. Pick the min over all
  // combinations × orderings. Budget-aware: cap total enumeration.
  const ordering = pickBestOrdering(graph, startKey, reachable, need, exitKey);
  return [...ordering, exitKey];
}

/**
 * Pick the best ordering of `need` pickups from `pickups`. Min total
 * A* cost from start → p1 → p2 → ... → exit.
 *
 *   - For K = need ≤ 4 (≤ 24 perms each combination): exhaustive.
 *   - For K > 4: greedy nearest-first followed by 2-opt local search
 *     (capped at 50 iterations).
 *
 * Returns an array of cell keys in visit order.
 */
function pickBestOrdering(graph, startKey, pickups, need, exitKey) {
  const M = pickups.length;
  if (need >= M) {
    // Visit all reachable pickups.
    return bestOrderOfSubset(graph, startKey, pickups, exitKey);
  }
  // need < M: enumerate combinations of `need` from `pickups`.
  // C(M, need): for M=5 need=3 → 10; M=7 need=3 → 35; M=8 need=4 → 70.
  // Bounded enough for v22.
  let best = null;
  let bestCost = Infinity;
  for (const subset of combinations(pickups, need)) {
    const order = bestOrderOfSubset(graph, startKey, subset, exitKey);
    const cost = totalChainCost(graph, startKey, [...order, exitKey]);
    if (cost < bestCost) {
      bestCost = cost;
      best = order;
    }
  }
  return best ?? [];
}

/** Yield all combinations of size k from `arr` (lex order). */
function* combinations(arr, k) {
  const n = arr.length;
  if (k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/** Find the min-cost ordering of `subset` visited in sequence from
 *  start, ending at exit. Exhaustive for K ≤ 4 (≤ 24 perms);
 *  greedy-nearest + 2-opt for K > 4. */
function bestOrderOfSubset(graph, startKey, subset, exitKey) {
  const K = subset.length;
  if (K === 0) return [];
  if (K === 1) return [subset[0]];
  if (K <= 4) {
    // Exhaustive permutation search.
    let best = null;
    let bestCost = Infinity;
    for (const perm of permutations(subset)) {
      const cost = totalChainCost(graph, startKey, [...perm, exitKey]);
      if (cost < bestCost) {
        bestCost = cost;
        best = perm;
      }
    }
    return best ?? subset;
  }
  // K > 4: greedy seed + 2-opt local search.
  const greedy = greedyNearest(graph, startKey, subset, exitKey);
  return twoOptImprove(graph, startKey, greedy, exitKey);
}

/** Generate all permutations of `arr`. */
function* permutations(arr) {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) {
      yield [arr[i], ...p];
    }
  }
}

/** Greedy nearest-first ordering — the v20/v21 algorithm.
 *  v26 M4: each leg's `cur` is normalised to a stateKey (bucket 0
 *  assumed) so A* can search from it. The cost estimates are
 *  consistent across legs; the actual planner loop uses real
 *  buckets from prev endState. */
function greedyNearest(graph, startKey, pickups, exitKey) {
  let cur = startKey;
  const remaining = [...pickups];
  const order = [];
  while (remaining.length > 0) {
    let bestKey = null;
    let bestCost = Infinity;
    for (const c of remaining) {
      const path = aStar(graph, cur, c);
      if (!path) continue;
      const cost = path.reduce((s, step) => s + step.edge.cost, 0);
      if (cost < bestCost) {
        bestCost = cost;
        bestKey = c;
      }
    }
    if (!bestKey) break;
    order.push(bestKey);
    // Normalise cellKey → stateKey for the next leg's aStar.
    cur = cellToBucket0(bestKey);
    remaining.splice(remaining.indexOf(bestKey), 1);
  }
  void exitKey; // unused; kept for symmetry
  return order;
}

/** v26 M4 + v27 M4: cellKey "r,c" → stateKey "r,c,0,L". Used by
 *  TSP helpers that thread cellKey goals through A*; the
 *  (bucket-0, L) assumption is the approximation noted in
 *  resolveGoals (spawn-grounded settle position). */
function cellToBucket0(k) {
  return k.split(',').length === 2 ? `${k},0,L` : k;
}

/** 2-opt local search on a tour. Tries swapping pairs of visits;
 *  keeps any swap that lowers total cost. Iterates until no
 *  improvement OR the iteration cap is reached. */
function twoOptImprove(graph, startKey, order, exitKey) {
  let best = [...order];
  let bestCost = totalChainCost(graph, startKey, [...best, exitKey]);
  let improved = true;
  let iter = 0;
  const MAX_ITER = 50;
  while (improved && iter < MAX_ITER) {
    improved = false;
    iter++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best];
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        const cost = totalChainCost(graph, startKey, [...candidate, exitKey]);
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Sum of A* costs for the chain start → goal[0] → goal[1] → ... .
 *  Returns Infinity if any leg is unreachable. */
function totalChainCost(graph, startKey, chain) {
  let cur = startKey;
  let total = 0;
  for (const g of chain) {
    const path = aStar(graph, cur, g);
    if (!path) return Infinity;
    total += path.reduce((s, step) => s + step.edge.cost, 0);
    // v26 M4: same normalisation as greedyNearest.
    cur = cellToBucket0(g);
  }
  return total;
}

// ---- Trace + recording emission -----------------------------------------

function whyForEdge(edge, subgoalName) {
  if (edge.kind === 'walk') return `walk ${edge.dir} toward ${subgoalName}`;
  if (edge.kind === 'jump') {
    if (edge.dir === 'still') return `jump up toward ${subgoalName}`;
    return `jump ${edge.dir} toward ${subgoalName}`;
  }
  if (edge.kind === 'drop') return `drop ${edge.dir} toward ${subgoalName}`;
  return `${edge.kind} toward ${subgoalName}`;
}

/**
 * Turn a sequence of A* path steps into:
 *   - trace      : Array<{ kind, target, why, frameRange, edgeId }>
 *   - recording  : Array<{ frame, key, down }>
 *
 * `currentFrame` and `currentDir` thread across legs so successive
 * walk-cells in the same direction don't re-press the key, and jumps
 * fire a one-frame space tap.
 */
function emitLegInputs(steps, subgoalName, ctx) {
  for (const step of steps) {
    const edge = step.edge;
    const [tr, tc] = edge.to.split(',').map(Number);
    const dir = edge.dir;

    // Direction key management.
    if (dir === 'left' || dir === 'right') {
      if (ctx.currentDir !== dir) {
        if (ctx.currentDir) {
          ctx.recording.push({ frame: ctx.frame, key: ctx.currentDir, down: false });
        }
        ctx.recording.push({ frame: ctx.frame, key: dir, down: true });
        ctx.currentDir = dir;
      }
    }

    // Jump fires a one-frame space tap at the START of the jump edge.
    if (edge.kind === 'jump') {
      ctx.recording.push({ frame: ctx.frame, key: 'space', down: true });
      ctx.recording.push({ frame: ctx.frame + 1, key: 'space', down: false });
      // v25 M2: emit the action's mid-arc direction release at the
      // build-time edge's `holdFrames` parameter. v24 M5 documented
      // this fix in isolation as regressing above_ground.txt; v25's
      // sub-pixel re-simulation (below) propagates the actual
      // endState so subsequent edges' start positions track physics
      // instead of cell-pixels, making the release-aware trajectory
      // converge end-to-end.
      const hf = edge.action?.params?.holdFrames;
      if (hf != null && hf < edge.cost && ctx.currentDir) {
        ctx.recording.push({ frame: ctx.frame + hf, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.jumps++;
    } else if (edge.kind === 'walk') {
      ctx.stats.walks++;
    } else if (edge.kind === 'drop') {
      ctx.stats.drops++;
    } else if (edge.kind === 'drop_release') {
      const rf = edge.action?.params?.releaseFrame;
      if (rf != null && rf < edge.cost && ctx.currentDir) {
        ctx.recording.push({ frame: ctx.frame + rf, key: ctx.currentDir, down: false });
        ctx.currentDir = null;
      }
      ctx.stats.drops++;
    } else if (edge.kind === 'run_off') {
      ctx.stats.walks++;
    }

    // v25 M2: re-simulate the action from the previous step's
    // actual endState so the cost we advance `ctx.frame` by matches
    // what the live engine will produce. Without this, the
    // recording's event timings diverge from physics for any
    // multi-step plan with sub-pixel drift. Falls back to the
    // build-time `edge.cost` when simContext is unavailable (e.g.
    // levels with no spawn — test fixtures).
    let stepCost = edge.cost;
    if (ctx.simContext && ctx.prevEndState && edge.action) {
      const reSim = simulateActionInContext(
        ctx.simContext,
        ctx.prevEndState,
        edge.action,
      );
      stepCost = reSim.cost;
      ctx.prevEndState = reSim.endState;
    }

    const startFrame = ctx.frame;
    ctx.frame += stepCost;
    ctx.trace.push({
      kind: edge.kind,
      target: { r: tr, c: tc },
      why: whyForEdge(edge, subgoalName),
      frameRange: [startFrame, ctx.frame],
      edgeId: `${step.from}>${edge.to}:${edge.kind}`,
    });
    ctx.stats.steps++;
    ctx.position = edge.to;
  }
}

// ---- Public plan + replan ----------------------------------------------

/**
 * Plan a path through the level.
 *
 * @param parsed   level.parse() result
 * @param legend   active tileset legend (used by grid.js to identify
 *                 pickup glyphs by role)
 * @param opts.blocked  Set<string> of edge IDs to exclude (replan)
 * @returns {
 *   trace:      Array<traceEntry>,
 *   recording:  Array<inputEvent>,
 *   stats:      { steps, jumps, walks, drops },
 *   graph:      the nav-graph used (so the runner can re-call replan
 *               without rebuilding),
 *   goals:      the resolved goal queue,
 *   unreachable: Array<{r,c}> pickup cells skipped because no path was found
 * }
 *
 * Plan is never null; if the exit is unreachable, the trace is empty
 * and recording.length === 0. The runner reports `ok: false` in that
 * case.
 */
export function plan(parsed, legend, opts = {}) {
  const blocked = opts.blocked instanceof Set ? opts.blocked : new Set();
  // v21: tileset is required by the action-graph builder (simAction
  // mints a PlaytestScene which consumes it). Callers pass it via
  // opts.tileset; legacy callers (tests) leave it null.
  const tileset = opts.tileset ?? null;
  const graph = buildNavGraph(parsed, legend, tileset);
  if (!graph.start || graph.exitCells.length === 0) {
    return emptyPlan(graph);
  }

  const requiredPickups = parsed?.meta?.pickupRequired ?? 'all';
  const goals = resolveGoals(graph, requiredPickups);
  if (goals.length === 0) return emptyPlan(graph);

  // v25 M2: sub-pixel-aware planner. Re-simulate each step's action
  // from the PREVIOUS step's actual endState (not the cell-pixel
  // start the build-time edge assumed). The cell-resolved graph
  // stays for A* search; this re-sim is purely for cost +
  // endState propagation so the recording's frame timings match
  // what the live engine will see.
  //
  // canBuildSimContext gating: matches buildNavGraph — if the level
  // has no spawn, simContext can't be created and we fall back to
  // build-time edge costs (the v24-and-earlier behaviour, byte-
  // identical when simContext is null).
  let simContext = null;
  try {
    simContext = makeSimContext(parsed, legend, tileset);
  } catch {
    simContext = null;
  }

  const ctx = {
    recording: [],
    trace: [],
    stats: { steps: 0, jumps: 0, walks: 0, drops: 0 },
    // Frame 1, not 0 — the player spawns mid-air at the P cell and
    // needs one update tick to settle onto the floor (set onGround =
    // true). A space press emitted at frame 0 is silently ignored by
    // the engine (`if (wantsJump && this.onGround)`); a 1-frame
    // settle delay makes jumps-as-first-action work without any
    // special-case code in the emitter.
    frame: 1,
    currentDir: null,
    // v26 M4 + v27 M4: position is now a stateKey
    // (cell × vxBucket × xOffsetBucket). Spawn settles vy=0, vx=0,
    // x=c*TILE → bucket (0, 'L'). After each leg, position is
    // updated to the last edge's `to` (which is a stateKey produced
    // by addActionEdges).
    position: stateKey(graph.start.r, graph.start.c, 0, 'L'),
    // v25 M2: simContext + prevEndState carry the sub-pixel state
    // across emit-leg calls. Initialised to the spawn cell's
    // grounded state — matches what the live engine's spawn-fall
    // settle leaves the player in (v22 M1).
    simContext,
    prevEndState: simContext
      ? {
          x: graph.start.c * TILE,
          y: graph.start.r * TILE,
          vx: 0,
          vy: 0,
          onGround: true,
        }
      : null,
  };
  const unreachable = [];

  for (const goal of goals) {
    const [gr, gc] = goal.split(',').map(Number);
    const subgoalName = describeGoal(graph, goal);
    // v27 M5: per-leg replan. With 9× state-space discretisation A*
    // can pick edges whose action sequence assumed a specific sub-
    // cell start (e.g., 'C' bucket = x in cell-middle); the live
    // engine's reSim may land in a neighbouring bucket. When the
    // next planned step's `from` doesn't match the LIVE bucket, the
    // recording's events for that step won't fire from where A*
    // assumed — replan from the live position to the SAME goal.
    let remaining = aStar(graph, ctx.position, goal, blocked);
    if (!remaining) {
      const isExit = graph.exitCells.some((e) => e.r === gr && e.c === gc);
      if (isExit) {
        return {
          trace: ctx.trace,
          recording: finaliseRecording(ctx),
          stats: ctx.stats,
          graph,
          goals,
          unreachable: [...unreachable, { r: gr, c: gc, kind: 'exit' }],
        };
      }
      unreachable.push({ r: gr, c: gc, kind: 'pickup' });
      continue;
    }
    let replanBudget = 48;
    while (remaining.length > 0 && replanBudget-- > 0) {
      emitLegInputs([remaining[0]], subgoalName, ctx);
      remaining = remaining.slice(1);
      if (remaining.length === 0 || !ctx.prevEndState) continue;
      // Re-derive the live bucket from prevEndState.
      const liveR = Math.floor((ctx.prevEndState.y + TILE / 2) / TILE);
      const liveC = Math.floor((ctx.prevEndState.x + TILE / 2) / TILE);
      const liveVxB = vxBucketOf(ctx.prevEndState.vx);
      const sub = ((ctx.prevEndState.x % TILE) + TILE) % TILE;
      let liveXOB = 'L';
      if (sub >= TILE / 3 && sub < (2 * TILE) / 3) liveXOB = 'C';
      else if (sub >= (2 * TILE) / 3) liveXOB = 'R';
      const liveKey = stateKey(liveR, liveC, liveVxB, liveXOB);
      if (remaining[0].from === liveKey) continue;          // chain still aligned
      if (!graph.nodes.has(liveKey)) continue;              // live position off-grid? trust plan
      ctx.position = liveKey;
      const fresh = aStar(graph, liveKey, goal, blocked);
      if (fresh) remaining = fresh;                          // replan succeeded
    }
  }

  return {
    trace: ctx.trace,
    recording: finaliseRecording(ctx),
    stats: ctx.stats,
    graph,
    goals,
    unreachable,
  };
}

function emptyPlan(graph) {
  return {
    trace: [],
    recording: [],
    stats: { steps: 0, jumps: 0, walks: 0, drops: 0 },
    graph,
    goals: [],
    unreachable: [],
  };
}

function finaliseRecording(ctx) {
  // Release the last held direction so the player doesn't keep
  // walking past the exit if the engine somehow runs extra frames.
  if (ctx.currentDir) {
    ctx.recording.push({ frame: ctx.frame, key: ctx.currentDir, down: false });
    ctx.currentDir = null;
  }
  return ctx.recording;
}

function describeGoal(graph, key) {
  const [r, c] = key.split(',').map(Number);
  if (graph.exitCells.some((e) => e.r === r && e.c === c)) {
    return `exit at (${c},${r})`;
  }
  const pickupIdx = graph.pickupCells.findIndex((p) => p.r === r && p.c === c);
  if (pickupIdx >= 0) return `pickup #${pickupIdx + 1} at (${c},${r})`;
  return `(${c},${r})`;
}

/**
 * Replan after a failed simulation. The simulator reports the player's
 * last position when the run ended in 'dead' or 'timeout'; we find the
 * trace entry whose `frameRange` contains the failure frame, mark its
 * edge as blocked, and re-run `plan` with the augmented block set.
 *
 * @param previous  the failed plan (from plan() or a prior replan())
 * @param sim       the failed simulation result
 * @param parsed    level.parse() (re-passed because plan() doesn't keep it)
 * @param legend    same
 * @returns         a fresh plan or `null` if no recoverable edge
 */
export function replan(previous, sim, parsed, legend, opts = {}) {
  if (!previous || !previous.trace.length) return null;
  // Find the failing trace entry: the one whose frameRange brackets
  // the failure frame. If the failure happened after all trace entries
  // (e.g. the agent walked into the exit but the win check failed),
  // fall back to the last entry.
  let failEntry = previous.trace.find(
    (e) => e.frameRange[0] <= sim.frame && sim.frame < e.frameRange[1],
  );
  if (!failEntry) failEntry = previous.trace[previous.trace.length - 1];
  const blocked = new Set([failEntry.edgeId]);
  // v21: tileset threads through opts so replans use the same graph
  // basis as the original plan.
  return plan(parsed, legend, { ...opts, blocked });
}
