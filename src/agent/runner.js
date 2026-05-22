// Runner orchestrates the v21 agent: plan -> simulate -> (if needed)
// replan, under a wall-clock time budget. Returns a Solution on
// success or a structured failure when the budget is exhausted.
//
// v21 changes from v20.1:
//   - testLevel becomes `async`. It yields periodically via
//     `setTimeout(0)` so the UI countdown timer can repaint and Esc
//     (via opts.signal) can interrupt.
//   - `maxRuntimeMs` (default 5000) is the primary cap; `replanBudget`
//     becomes a secondary safety cap (10) that triggers only if the
//     time-budget loop somehow doesn't terminate.
//   - `onProgress(elapsedMs, totalMs)` fires at each yield point so
//     the dialog can render "Searching… 3.7s remaining".
//   - Tileset threaded through to plan() so the action-graph
//     builder (M3) can run simAction.

import { simulate } from './sim.js';
import { plan, replan } from './planner.js';

const SIM_MAX_FRAMES = 1200; // 20 simulated seconds at 60fps

/**
 * Test a level: plan + headless-validate + replan under a time budget.
 *
 * @param parsed   level.parse() result
 * @param legend   active tileset legend
 * @param tileset  active tileset object (or null)
 * @param opts.maxRuntimeMs   wall-clock budget (default 5000)
 * @param opts.onProgress     (elapsedMs, totalMs) => void; called at
 *                            each yield point
 * @param opts.signal         AbortController.signal; Esc handlers
 *                            abort by calling .abort() on the
 *                            controller
 * @param opts.replanBudget   safety cap on number of replans
 *                            (default 10; only fires if the time
 *                            budget loop doesn't terminate)
 *
 * @returns Promise<
 *   { ok: true,  solution: {plan, recording, stats, unreachable} } |
 *   { ok: false, lastPlan, lastSim, attempts, reason? }
 * >
 */
export async function testLevel(parsed, legend, tileset, opts = {}) {
  const maxRuntimeMs = opts.maxRuntimeMs ?? 5000;
  const onProgress = opts.onProgress ?? (() => {});
  const signal = opts.signal;
  const replanBudget = opts.replanBudget ?? 10;
  const startTime = Date.now();

  // Yield helper. Returns false if time's up or the caller aborted.
  async function yieldTick() {
    const elapsed = Date.now() - startTime;
    onProgress(elapsed, maxRuntimeMs);
    if (signal?.aborted) return false;
    if (elapsed >= maxRuntimeMs) return false;
    await new Promise((r) => setTimeout(r, 0));
    return true;
  }

  // Initial plan. Build is synchronous for now (the graph build can
  // take ~1s for big levels; v22 candidate to yield mid-build).
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

  let lastSim = null;
  let attempt = 0;

  while (attempt < replanBudget) {
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
      return {
        ok: true,
        solution: {
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
        },
      };
    }
    if (!(await yieldTick())) break;

    const next = replan(currentPlan, sim, parsed, legend, { tileset });
    if (!next || next.trace.length === 0 || sameRecording(currentPlan, next)) {
      break;
    }
    currentPlan = next;
    if (!(await yieldTick())) break;
  }

  return {
    ok: false,
    lastPlan: currentPlan,
    lastSim,
    attempts: attempt,
  };
}

/** Two recordings are "the same" if they emit the same key events in
 *  the same order at the same frames. Used to detect replan stagnation
 *  (replanning that doesn't actually change the plan). */
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
