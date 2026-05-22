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

import { buildNavGraph, cellKey } from './grid.js';

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
 * @param from         "r,c" key
 * @param to           "r,c" key
 * @param blocked      optional Set<string> of edge IDs to exclude (replan)
 * @returns Array<{from, edge, cost}> the path, or null if unreachable.
 */
export function aStar(graph, from, to, blocked = new Set()) {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) return null;
  if (from === to) return [];

  const [fr, fc] = from.split(',').map(Number);
  const [tr, tc] = to.split(',').map(Number);

  const open = new Set([from]);
  const cameFrom = new Map(); // node → { from, edge }
  const gScore = new Map([[from, 0]]);
  const fScore = new Map([[from, heuristic(fr, fc, tr, tc)]]);

  while (open.size > 0) {
    const current = lowestF(open, fScore);
    if (current === to) {
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
 *   - N      → visit the N nearest pickups (greedy by A* cost), then exit.
 *
 * Returns an ordered list of "r,c" goal keys. Pickups are sub-goals;
 * the final entry is always an exit cell. Unreachable pickups are
 * skipped (in `all` mode) so the planner can still attempt the exit
 * — the runner reports the partial-completability separately.
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

  // Greedy nearest-first ordering. We simulate the agent's position as
  // it visits each pickup, choosing the unvisited pickup with the
  // shortest A* cost from the current position. Pickups that turn out
  // unreachable are dropped from the queue (the runner reports them).
  const startCell = graph.start;
  if (!startCell) return [exitKey];
  let cur = cellKey(startCell.r, startCell.c);
  const remaining = graph.pickupCells.map((p) => cellKey(p.r, p.c));
  const queue = [];

  while (queue.length < need && remaining.length > 0) {
    let bestKey = null;
    let bestCost = Infinity;
    let bestPath = null;
    for (const candidate of remaining) {
      const path = aStar(graph, cur, candidate);
      if (!path) continue;
      const cost = path.reduce((sum, step) => sum + step.edge.cost, 0);
      if (cost < bestCost) {
        bestCost = cost;
        bestKey = candidate;
        bestPath = path;
      }
    }
    if (!bestKey) break; // no reachable pickups remain
    queue.push(bestKey);
    cur = bestKey;
    remaining.splice(remaining.indexOf(bestKey), 1);
    // We don't store bestPath here — the main plan() loop re-runs A*
    // to get fresh paths (the blocked-edge set may have changed by
    // then in a replan scenario).
    void bestPath;
  }

  queue.push(exitKey);
  return queue;
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
      ctx.stats.jumps++;
    } else if (edge.kind === 'walk') {
      ctx.stats.walks++;
    } else if (edge.kind === 'drop') {
      ctx.stats.drops++;
    }

    const startFrame = ctx.frame;
    ctx.frame += edge.cost;
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
  const graph = buildNavGraph(parsed, legend);
  if (!graph.start || graph.exitCells.length === 0) {
    return emptyPlan(graph);
  }

  const requiredPickups = parsed?.meta?.pickupRequired ?? 'all';
  const goals = resolveGoals(graph, requiredPickups);
  if (goals.length === 0) return emptyPlan(graph);

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
    position: cellKey(graph.start.r, graph.start.c),
  };
  const unreachable = [];

  for (const goal of goals) {
    const [gr, gc] = goal.split(',').map(Number);
    const path = aStar(graph, ctx.position, goal, blocked);
    if (!path) {
      // Pickup unreachable — skip; continue with the rest of the queue.
      // Exit unreachable → bail; the trace returned so far reflects what
      // the agent COULD do up to that point.
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
    const subgoalName = describeGoal(graph, goal);
    emitLegInputs(path, subgoalName, ctx);
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
export function replan(previous, sim, parsed, legend) {
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
  // Preserve any previously-blocked edges by reading them from the
  // previous plan's graph if needed — for v20 we trust the caller
  // (runner) to merge blocked sets across replans.
  return plan(parsed, legend, { blocked });
}
