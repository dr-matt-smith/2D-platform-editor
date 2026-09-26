import { PlannerFactory } from './PlannerFactory.ts';
import { FailureReason } from './FailureReason.ts';
import { SearchBudget } from './SearchBudget.ts';
import { SimOutcome } from './SimOutcome.ts';
import { Simulator } from './Simulator.ts';
import { Solution } from './Solution.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { LevelTestResult } from './LevelTestResult.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { Planner } from './Planner.ts';
import type { PlannerKind } from './PlannerKind.ts';
import type { ProgressListener } from './SearchBudget.ts';
import type { SimResult } from './Simulator.ts';

/** Options for LevelTester.test. */
export interface LevelTestOptions {
  /** Wall-clock budget in ms (default 5000). */
  maxRuntimeMs?: number;
  /** Called between steps with the time used so far. */
  onProgress?: ProgressListener;
  /** Abort the search early. */
  signal?: AbortSignal;
  /** Most plan-then-replay attempts (default 10). */
  replanBudget?: number;
}

/**
 * Answers "can this level be solved, and how?" — the editor's Test
 * button and `deno task solve`. It plans, replays the plan headless to
 * check it really wins, and then looks for different routes by blocking
 * one step of each solution and planning again, collecting up to five
 * distinct solutions within the time budget. A plan that fails its
 * replay is replanned around the step that failed.
 */
export class LevelTester {
  /** The most distinct solutions a test collects. */
  static readonly MAX_SOLUTIONS = 5;
  /** Replay budget in frames (40 s of game time). */
  static readonly SIM_MAX_FRAMES = 2400;

  private constructor(private readonly planner: Planner, private readonly simulator: Simulator) {}

  /** A tester driving `adapter` with the given planning strategy (default per-frame). */
  static create(adapter: PhysicsAdapter, kind: PlannerKind = PlannerFactory.DEFAULT_KIND): LevelTester {
    return new LevelTester(PlannerFactory.create(adapter, kind), new Simulator(adapter));
  }

  /** Test a level: plan, replay, replan and collect solutions within the budget. */
  async test(
    parsed: ParsedLevel,
    legend: LegendRecord | null,
    tileset: unknown,
    options: LevelTestOptions = {},
  ): Promise<LevelTestResult> {
    const budget = new SearchBudget(options.maxRuntimeMs ?? 5000, options.onProgress, options.signal);
    const replanBudget = options.replanBudget ?? 10;

    let currentPlan = this.planner.plan(parsed, legend, { tileset });
    if (!(await budget.tick())) {
      return {
        ok: false,
        lastPlan: currentPlan,
        lastSim: null,
        attempts: 0,
        reason: FailureReason.TimeoutDuringPlan,
      };
    }

    if (currentPlan.isEmpty) {
      return {
        ok: false,
        lastPlan: currentPlan,
        lastSim: null,
        attempts: 0,
      };
    }

    const solutions: Solution[] = [];
    const seenRecordings = new Set<string>();
    let lastSim: SimResult | null = null;
    let attempt = 0;
    const blockedAcrossSolutions = new Set<string>();

    while (attempt < replanBudget && solutions.length < LevelTester.MAX_SOLUTIONS) {
      attempt++;
      const sim = this.simulator.run(parsed, legend, currentPlan.recording, {
        tileset,
        maxFrames: LevelTester.SIM_MAX_FRAMES,
      });
      lastSim = sim;
      if (sim.outcome === SimOutcome.Won) {
        const key = currentPlan.recordingKey();
        if (!seenRecordings.has(key)) {
          seenRecordings.add(key);
          solutions.push(Solution.fromWin(currentPlan, sim, attempt));
        }
        if (solutions.length >= LevelTester.MAX_SOLUTIONS) break;
        if (!(await budget.tick())) break;

        // Look for a different route: block this solution's longest step
        // (usually its most distinctive) and plan again.
        const blockEdge = currentPlan.longestStepNotIn(blockedAcrossSolutions);
        if (!blockEdge) break;
        blockedAcrossSolutions.add(blockEdge);
        const alt = this.planner.plan(parsed, legend, { tileset, blocked: blockedAcrossSolutions });
        if (!alt || alt.isEmpty) break;
        if (currentPlan.hasSameRecordingAs(alt)) break;
        currentPlan = alt;
        continue;
      }
      if (!(await budget.tick())) break;

      const next = this.planner.replan(currentPlan, sim, parsed, legend, { tileset });
      if (!next || next.isEmpty || currentPlan.hasSameRecordingAs(next)) {
        break;
      }
      currentPlan = next;
      if (!(await budget.tick())) break;
    }

    if (solutions.length > 0) {
      solutions.sort((a, b) => a.stats.frame - b.stats.frame);
      return {
        ok: true,
        solutions,
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
}
