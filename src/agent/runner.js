// Runner orchestrates the v21/v22 agent: plan -> simulate -> replan,
// under a wall-clock time budget. v22 returns up to K solutions (the
// user can compare alternatives via the dialog).
//
// v22 changes from v21:
//   - testLevel returns a `solutions: Array<Solution>` field (up to
//     5 unique recordings, sorted by frame cost).
//   - `solution = solutions[0]` retained as a back-compat alias.
//   - After the first successful plan, the runner blocks the edges
//     in that solution one at a time and re-plans. Unique
//     successful alternatives are added to the list. Stops at K=5
//     OR when time/budget runs out OR when no more unique paths
//     surface.

import { simulate } from './sim.js';
import { plan, replan } from './planner.js';

// v26 M4: bumped from 1200 → 2400 (20s → 40s sim time). The
// sub-pixel state-space A* graph has 3× more nodes; plans that
// chain through more bucket variants can exceed 20s sim time.
// Genuinely-stuck plans still terminate within the wall-clock
// budget — the simulator is fast (~50µs per frame).
const SIM_MAX_FRAMES = 2400;
const MAX_SOLUTIONS = 5;

/**
 * Test a level: plan + headless-validate + replan under a time budget.
 *
 * @returns Promise<
 *   { ok: true, solutions: Solution[], solution: Solution, ... } |
 *   { ok: false, lastPlan, lastSim, attempts, reason? }
 * >
 */
export async function testLevel(parsed, legend, tileset, opts = {}) {
  const maxRuntimeMs = opts.maxRuntimeMs ?? 5000;
  const onProgress = opts.onProgress ?? (() => {});
  const signal = opts.signal;
  const replanBudget = opts.replanBudget ?? 10;
  const startTime = Date.now();

  async function yieldTick() {
    const elapsed = Date.now() - startTime;
    onProgress(elapsed, maxRuntimeMs);
    if (signal?.aborted) return false;
    if (elapsed >= maxRuntimeMs) return false;
    await new Promise((r) => setTimeout(r, 0));
    return true;
  }

  // Initial plan.
  let currentPlan = plan(parsed, legend, { tileset });
  if (!(await yieldTick())) {
    return {
      ok: false,
      lastPlan: currentPlan,
      lastSim: null,
      attempts: 0,
      reason: 'timeout-during-plan',
    };
  }

  if (currentPlan.trace.length === 0) {
    return {
      ok: false,
      lastPlan: currentPlan,
      lastSim: null,
      attempts: 0,
    };
  }

  // v22: collect solutions (up to MAX_SOLUTIONS unique recordings).
  const solutions = [];
  const seenRecordings = new Set();
  let lastSim = null;
  let attempt = 0;
  const blockedAcrossSolutions = new Set();

  while (attempt < replanBudget && solutions.length < MAX_SOLUTIONS) {
    attempt++;
    const sim = simulate({
      parsed,
      legend,
      tileset,
      recording: currentPlan.recording,
      maxFrames: SIM_MAX_FRAMES,
    });
    lastSim = sim;
    if (sim.outcome === 'won') {
      const hash = recordingHash(currentPlan.recording);
      if (!seenRecordings.has(hash)) {
        seenRecordings.add(hash);
        solutions.push({
          plan: currentPlan,
          recording: currentPlan.recording,
          stats: {
            steps: currentPlan.stats.steps,
            walks: currentPlan.stats.walks,
            jumps: currentPlan.stats.jumps,
            drops: currentPlan.stats.drops,
            attempts: attempt,
            frame: sim.frame,
            score: sim.score,
          },
          unreachable: currentPlan.unreachable,
        });
      }
      if (solutions.length >= MAX_SOLUTIONS) break;
      if (!(await yieldTick())) break;

      // v22: find an alternative by blocking one of this solution's
      // edges and re-planning. We pick the LONGEST edge in the trace
      // (typically the most distinctive — a long walk or jump) so
      // the alternative is meaningfully different.
      const blockEdge = pickEdgeToBlock(currentPlan, blockedAcrossSolutions);
      if (!blockEdge) break;
      blockedAcrossSolutions.add(blockEdge);
      const alt = plan(parsed, legend, { tileset, blocked: blockedAcrossSolutions });
      if (!alt || alt.trace.length === 0) break;
      if (sameRecording(currentPlan, alt)) break;
      currentPlan = alt;
      continue;
    }
    if (!(await yieldTick())) break;

    const next = replan(currentPlan, sim, parsed, legend, { tileset });
    if (!next || next.trace.length === 0 || sameRecording(currentPlan, next)) {
      break;
    }
    currentPlan = next;
    if (!(await yieldTick())) break;
  }

  if (solutions.length > 0) {
    // Sort by cost (frame count) ascending. v22 doc says shortest first.
    solutions.sort((a, b) => a.stats.frame - b.stats.frame);
    return {
      ok: true,
      solutions,
      // Back-compat: v20/v21 callers read `.solution`.
      solution: solutions[0],
    };
  }

  return {
    ok: false,
    lastPlan: currentPlan,
    lastSim,
    attempts: attempt,
  };
}

/** Pick a representative edge from the plan's trace to block when
 *  searching for alternatives. Returns the edgeId of the longest-cost
 *  edge not already in `alreadyBlocked`. */
function pickEdgeToBlock(plan, alreadyBlocked) {
  let best = null;
  let bestCost = -1;
  for (const entry of plan.trace) {
    if (alreadyBlocked.has(entry.edgeId)) continue;
    const cost = entry.frameRange[1] - entry.frameRange[0];
    if (cost > bestCost) {
      bestCost = cost;
      best = entry.edgeId;
    }
  }
  return best;
}

/** Two recordings are "the same" if they emit the same key events in
 *  the same order at the same frames. Used to detect replan stagnation
 *  and to dedupe solutions. */
function sameRecording(a, b) {
  if (!a || !b) return false;
  if (a.recording.length !== b.recording.length) return false;
  for (let i = 0; i < a.recording.length; i++) {
    const ea = a.recording[i];
    const eb = b.recording[i];
    if (ea.frame !== eb.frame || ea.key !== eb.key || ea.down !== eb.down) return false;
  }
  return true;
}

/** Short hash of a recording for deduplication. Joins all events
 *  into a single string. */
function recordingHash(events) {
  return events.map((e) => `${e.frame}|${e.key}|${e.down ? 1 : 0}`).join(',');
}
