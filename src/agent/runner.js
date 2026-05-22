// Runner orchestrates the v20 agent: plan -> simulate -> (if needed)
// replan, up to a budget. Returns a Solution object on success or a
// structured failure on giving up.
//
// Pure: no DOM. The runner imports the simulator (which uses the
// vendored PlaytestScene under the hood, no canvas), plus the planner.

import { simulate } from './sim.js';
import { plan, replan } from './planner.js';

/**
 * Test a level: plan + headless-validate + replan.
 *
 * @param parsed   level.parse() result
 * @param legend   active tileset legend
 * @param tileset  active tileset object (or null for offline / Dirt-only)
 * @param opts.replanBudget  attempts before giving up (default 3)
 * @param opts.maxFrames     simulator frame budget per attempt (default 600)
 *
 * @returns
 *   On success: { ok: true, solution: {
 *     plan, recording, stats: { steps, jumps, walks, drops, attempts,
 *     frame, score }, unreachable: [] }}
 *
 *   On failure: { ok: false, lastPlan, lastSim, attempts }
 *
 * The `solution.plan` shape mirrors plan()'s return — the dialog reads
 * `.trace` for the explainable list and `.goals`/`.graph` for the
 * overlay's numbered markers.
 */
export function testLevel(parsed, legend, tileset, opts = {}) {
  const budget = opts.replanBudget ?? 3;
  const maxFrames = opts.maxFrames ?? 600;

  let currentPlan = plan(parsed, legend);
  let lastSim = null;

  // Empty plan = exit unreachable. The runner doesn't bother simulating;
  // there's nothing to validate. The dialog renders the unreachable list
  // as the failure diagnostic.
  if (currentPlan.trace.length === 0) {
    return {
      ok: false,
      lastPlan: currentPlan,
      lastSim: null,
      attempts: 0,
    };
  }

  for (let attempt = 1; attempt <= budget; attempt++) {
    const sim = simulate({
      parsed,
      legend,
      tileset,
      recording: currentPlan.recording,
      maxFrames,
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
    // 'dead' or 'timeout' — try to replan around the failing edge.
    const next = replan(currentPlan, sim, parsed, legend);
    if (!next || next.trace.length === 0 || sameRecording(currentPlan, next)) {
      // Either no recoverable edge, or replan produced the same plan
      // (no progress possible) — give up.
      break;
    }
    currentPlan = next;
  }

  return {
    ok: false,
    lastPlan: currentPlan,
    lastSim,
    attempts: budget,
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
