import { AdapterGuard } from './AdapterGuard.ts';
import { CellKey } from './CellKey.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { Plan } from './Plan.ts';
import type { PlannerKind } from './PlannerKind.ts';
import type { SimResult } from './Simulator.ts';

/** Options for one call to Planner.plan. */
export interface PlanOptions {
  /** Passed to the adapter's makeScene; opaque to the agent. */
  tileset?: unknown;
  /** Edge ids ("from>to:kind") the plan must not use. */
  blocked?: ReadonlySet<string>;
}

/**
 * A strategy for finding a key recording that solves a level. Both
 * planners visit the goals (the required pickups, then an exit) one leg
 * at a time and write the same kind of Plan; they differ in how a leg is
 * searched. Pick one with PlannerFactory.
 */
export abstract class Planner {
  /** Which strategy this is. */
  abstract readonly kind: PlannerKind;

  /** Throws (via AdapterGuard) if the adapter is missing or its TILE is wrong. */
  protected constructor(protected readonly adapter: PhysicsAdapter) {
    AdapterGuard.assert(adapter, 'Planner');
  }

  /** Plan a route through the level. Never null; see Plan. */
  abstract plan(parsed: ParsedLevel, legend: LegendRecord | null, options?: PlanOptions): Plan;

  /**
   * Plan again after `previous` failed in simulation: block the step that
   * was running when the replay failed (on top of any `options.blocked`)
   * and plan once more. Null when there is nothing to block.
   */
  replan(
    previous: Plan | null,
    sim: SimResult,
    parsed: ParsedLevel,
    legend: LegendRecord | null,
    options: PlanOptions = {},
  ): Plan | null {
    if (!previous || previous.isEmpty) return null;
    const failing = previous.stepAtFrame(sim.frame)!;
    const blocked = new Set([...(options.blocked ?? []), failing.edgeId]);
    return this.plan(parsed, legend, { ...options, blocked });
  }

  /**
   * Name a goal cell for a trace's "why" text: "exit at (c,r)",
   * "pickup #n at (c,r)", or `otherPrefix` + "(c,r)" for anything else.
   */
  protected static describeGoal(goalKey: string, layout: LevelLayout, otherPrefix: string): string {
    const { r, c } = CellKey.parse(goalKey);
    if (layout.exitCells.some((e) => e.r === r && e.c === c)) {
      return `exit at (${c},${r})`;
    }
    const pickupIdx = layout.pickupCells.findIndex((p) => p.r === r && p.c === c);
    if (pickupIdx >= 0) return `pickup #${pickupIdx + 1} at (${c},${r})`;
    return `${otherPrefix}(${c},${r})`;
  }
}
