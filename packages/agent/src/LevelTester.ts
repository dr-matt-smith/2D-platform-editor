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
import type { Plan } from './Plan.ts';

/** Options for LevelTester.test. */
export interface LevelTestOptions {
  /** Wall-clock budget in ms (default 5000). */
  maxRuntimeMs?: number;
  /** Called between steps with the time used so far. */
  onProgress?: ProgressListener;
  /** Abort the search early. */
  signal?: AbortSignal;
  /** Most plan-then-replay attempts (default 20). */
  replanBudget?: number;
}

/**
 * Answers "can this level be solved, and how?" — the editor's Test
 * button and `deno task solve`. It plans, replays the plan headless to
 * check it really wins, and then searches for different routes: for each
 * solution it queues one variation per step, each blocking that step on
 * top of the blocks that produced the solution, and works through the
 * queue breadth first. It collects up to five solutions that differ in
 * both route (`Plan.routeKey`) and keys (`Plan.recordingKey`) within the
 * attempt and time budgets. A plan that fails its replay is replanned around the step
 * that failed.
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
    const replanBudget = options.replanBudget ?? 20;

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
    // A solution counts as new only if both its route and its keys are.
    const seenRoutes = new Set<string>();
    const seenRecordings = new Set<string>();
    const isNew = (plan: Plan) => !seenRoutes.has(plan.routeKey()) && !seenRecordings.has(plan.recordingKey());
    const alternatives = new AlternativeQueue();
    // The steps the current plan was made to avoid.
    let blocked: ReadonlySet<string> = new Set();
    let lastSim: SimResult | null = null;
    let attempt = 0;

    while (attempt < replanBudget && solutions.length < LevelTester.MAX_SOLUTIONS) {
      attempt++;
      const sim = this.simulator.run(parsed, legend, currentPlan.recording, {
        tileset,
        maxFrames: LevelTester.SIM_MAX_FRAMES,
      });
      lastSim = sim;
      if (!(await budget.tick())) break;

      let next: Plan | null = null;
      if (sim.outcome === SimOutcome.Won) {
        if (isNew(currentPlan)) {
          seenRoutes.add(currentPlan.routeKey());
          seenRecordings.add(currentPlan.recordingKey());
          solutions.push(Solution.fromWin(currentPlan, sim, attempt));
          alternatives.addVariationsOf(currentPlan, blocked);
        }
      } else {
        // Replan around the step that was running when the replay failed.
        const repaired = this.planner.replan(currentPlan, sim, parsed, legend, { tileset, blocked });
        if (repaired && !repaired.isEmpty && !currentPlan.hasSameRecordingAs(repaired)) {
          next = repaired;
          blocked = new Set([...blocked, currentPlan.stepAtFrame(sim.frame)!.edgeId]);
        }
      }
      if (solutions.length >= LevelTester.MAX_SOLUTIONS) break;

      // Otherwise try queued variations until one plans a route not yet seen.
      while (!next) {
        const candidate = alternatives.next();
        if (!candidate) break;
        const plan = this.planner.plan(parsed, legend, { tileset, blocked: candidate });
        if (!(await budget.tick())) break;
        if (!plan.isEmpty && isNew(plan)) {
          next = plan;
          blocked = candidate;
        }
      }
      if (!next) break;
      currentPlan = next;
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

/**
 * The block sets still to try when looking for different routes, first
 * in first out. A set is only queued once, however many solutions lead
 * to it.
 */
class AlternativeQueue {
  private readonly pending: ReadonlySet<string>[] = [];
  private readonly queued = new Set<string>();

  /** Queue one variation of `plan` per step: its blocks plus that step. */
  addVariationsOf(plan: Plan, blocked: ReadonlySet<string>): void {
    for (const step of plan.stepsToBlock(blocked)) {
      const candidate = new Set([...blocked, step]);
      const key = [...candidate].sort().join('|');
      if (this.queued.has(key)) continue;
      this.queued.add(key);
      this.pending.push(candidate);
    }
  }

  /** The next block set to try, or undefined when there are none left. */
  next(): ReadonlySet<string> | undefined {
    return this.pending.shift();
  }
}
