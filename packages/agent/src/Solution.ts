import type { Plan, UnreachableGoal } from './Plan.ts';
import type { Recording } from './RecordingEvent.ts';
import type { SimResult } from './Simulator.ts';

/** A solution's numbers, as the editor's dialog and the CLI show them. */
export interface SolutionStats {
  steps: number;
  walks: number;
  jumps: number;
  drops: number;
  /** Which attempt (plan, then replay) found it. */
  attempts: number;
  /** The frame the replay won on. */
  frame: number;
  /** Pickups collected. */
  score: number;
}

/** A plan whose recording won a headless replay. */
export class Solution {
  /** The key events to replay. */
  readonly recording: Recording;
  readonly stats: SolutionStats;
  /** Goals the plan skipped (optional pickups). */
  readonly unreachable: UnreachableGoal[];

  private constructor(readonly plan: Plan, stats: SolutionStats) {
    this.recording = plan.recording;
    this.stats = stats;
    this.unreachable = plan.unreachable;
  }

  /** The solution `plan` became when its replay (`sim`) won on attempt `attempt`. */
  static fromWin(plan: Plan, sim: SimResult, attempt: number): Solution {
    return new Solution(plan, {
      steps: plan.stats.steps,
      walks: plan.stats.walks,
      jumps: plan.stats.jumps,
      drops: plan.stats.drops,
      attempts: attempt,
      frame: sim.frame,
      score: sim.score,
    });
  }
}
