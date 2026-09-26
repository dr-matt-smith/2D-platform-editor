import { TILE } from './constants.ts';
import { ActionKind } from './ActionKind.ts';
import { ActionSimulator } from './ActionSimulator.ts';
import { CellKey } from './CellKey.ts';
import { DropReleaseAction } from './DropReleaseAction.ts';
import { GoalKind } from './GoalKind.ts';
import { JumpAction } from './JumpAction.ts';
import { NavGraph } from './NavGraph.ts';
import { PickupTour } from './PickupTour.ts';
import { Plan } from './Plan.ts';
import { PlanBuilder } from './PlanBuilder.ts';
import { Planner } from './Planner.ts';
import { PlannerKind } from './PlannerKind.ts';
import { StateKey } from './StateKey.ts';
import { XOffsetBucket } from './XOffsetBucket.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { NavEdge, NavPathStep } from './NavGraph.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { PlanOptions } from './Planner.ts';
import type { PlayerState } from './PlayerState.ts';
import type { UnreachableGoal } from './Plan.ts';

// Where the player really is as the plan is written.
interface LegState {
  /** The node the next leg searches from. */
  position: string;
  /** Re-simulates each step from the real state (null if there's no scene). */
  simulator: ActionSimulator | null;
  /** The exact state after the last step. */
  endState: PlayerState | null;
}

/**
 * The older planning strategy, kept for diagnostics: build the whole
 * NavGraph up front, order the pickups with PickupTour, then A* each leg
 * over the graph's bucketed states.
 *
 * Buckets are approximate, so as it writes each step it re-simulates the
 * action from the player's real state. The real cost sets the timing of
 * the recording, and if the player has drifted into a different bucket
 * than the path assumed, it searches again from where the player really
 * is.
 */
export class BucketPlanner extends Planner {
  readonly kind = PlannerKind.Bucket;

  constructor(adapter: PhysicsAdapter) {
    super(adapter);
  }

  plan(parsed: ParsedLevel, legend: LegendRecord | null, options: PlanOptions = {}): Plan {
    const blocked = options.blocked instanceof Set ? options.blocked : new Set<string>();
    const tileset = options.tileset ?? null;
    const graph = NavGraph.build(this.adapter, parsed, legend, tileset);
    if (!graph.start || graph.exitCells.length === 0) {
      return Plan.empty(graph);
    }

    const requiredPickups = parsed?.meta?.pickupRequired ?? 'all';
    const goals = PickupTour.resolve(graph, requiredPickups);
    if (goals.length === 0) return Plan.empty(graph);

    // A level with no spawn can't make a scene; then the build-time edge
    // costs are used as they are.
    let simulator: ActionSimulator | null = null;
    try {
      simulator = ActionSimulator.create(this.adapter, parsed, legend, tileset);
    } catch {
      simulator = null;
    }

    const builder = new PlanBuilder();
    // The settled spawn: still, at the left of its cell.
    const leg: LegState = {
      position: StateKey.of(graph.start.r, graph.start.c, 0, XOffsetBucket.Left).toString(),
      simulator,
      endState: simulator
        ? {
            x: graph.start.c * TILE,
            y: graph.start.r * TILE,
            vx: 0,
            vy: 0,
            onGround: true,
          }
        : null,
    };
    const unreachable: UnreachableGoal[] = [];

    for (const goal of goals) {
      const { r: gr, c: gc } = CellKey.parse(goal);
      const subgoalName = Planner.describeGoal(goal, graph, '');
      let remaining = graph.findPath(leg.position, goal, blocked);
      if (!remaining) {
        const isExit = graph.exitCells.some((e) => e.r === gr && e.c === gc);
        if (isExit) {
          builder.releaseHeldDirection();
          return builder.build(graph, goals, [...unreachable, { r: gr, c: gc, kind: GoalKind.Exit }]);
        }
        unreachable.push({ r: gr, c: gc, kind: GoalKind.Pickup });
        continue;
      }
      // Write one step at a time. If the re-simulated player is no longer
      // where the rest of the path starts, search again from the real
      // position (at most 48 steps per goal).
      let replanBudget = 48;
      while (remaining.length > 0 && replanBudget-- > 0) {
        this.writeStep(builder, remaining[0], subgoalName, leg);
        remaining = remaining.slice(1);
        if (remaining.length === 0 || !leg.endState) continue;
        const liveKey = StateKey.ofState(leg.endState).toString();
        if (remaining[0].from === liveKey) continue;          // still on the path
        if (!graph.hasNode(liveKey)) continue;                // off the graph: trust the path
        leg.position = liveKey;
        const fresh = graph.findPath(liveKey, goal, blocked);
        if (fresh) remaining = fresh;
      }
    }

    builder.releaseHeldDirection();
    return builder.build(graph, goals, unreachable);
  }

  // Record one path step: its keys, then its real cost from a re-simulation.
  private writeStep(builder: PlanBuilder, step: NavPathStep, subgoalName: string, leg: LegState): void {
    const edge = step.edge;
    const target = CellKey.parse(edge.to);
    const action = edge.action;

    builder.holdDirection(edge.dir);
    // A jump taps space at its start and lets go of the direction at its
    // hold frame; a drop-and-release lets go at its release frame.
    if (action instanceof JumpAction) {
      builder.tapJump();
      builder.releaseDirectionAfter(action.holdFrames, edge.cost);
    } else if (action instanceof DropReleaseAction) {
      builder.releaseDirectionAfter(action.releaseFrame, edge.cost);
    }

    // Re-simulate from the previous step's real end state, so the frames
    // the recording advances by match what the live engine will do.
    let stepCost = edge.cost;
    if (leg.simulator && leg.endState) {
      const reSim = leg.simulator.simulate(leg.endState, action);
      stepCost = reSim.cost;
      leg.endState = reSim.endState;
    }

    builder.addStep(edge.kind, target, BucketPlanner.explain(edge, subgoalName), stepCost, `${step.from}>${edge.to}:${edge.kind}`);
    leg.position = edge.to;
  }

  // The trace's "why" text for a step.
  private static explain(edge: NavEdge, subgoalName: string): string {
    if (edge.kind === ActionKind.Walk) return `walk ${edge.dir} toward ${subgoalName}`;
    if (edge.kind === ActionKind.Jump) return `jump ${edge.dir} toward ${subgoalName}`;
    if (edge.kind === ActionKind.Drop) return `drop ${edge.dir} toward ${subgoalName}`;
    return `${edge.kind} toward ${subgoalName}`;
  }
}
