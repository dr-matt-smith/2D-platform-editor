import { TILE } from './constants.ts';
import { CellKey } from './CellKey.ts';
import { DropAction } from './DropAction.ts';
import { DropReleaseAction } from './DropReleaseAction.ts';
import { GoalKind } from './GoalKind.ts';
import { JumpAction } from './JumpAction.ts';
import { LevelGrid } from './LevelGrid.ts';
import { PerFrameExpander } from './PerFrameExpander.ts';
import { Plan } from './Plan.ts';
import { PlanBuilder } from './PlanBuilder.ts';
import { Planner } from './Planner.ts';
import { PlannerKind } from './PlannerKind.ts';
import { RunOffAction } from './RunOffAction.ts';
import { StateCluster } from './StateCluster.ts';
import { WalkAction } from './WalkAction.ts';
import type { ClusterTolerance } from './StateCluster.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PerFrameEdge, PerFrameStep } from './PerFrameExpander.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { PlanOptions } from './Planner.ts';
import type { PlayerState } from './PlayerState.ts';
import type { Cell } from './Cell.ts';
import type { UnreachableGoal } from './Plan.ts';

/** Tuning for the per-frame search. */
export interface PerFramePlannerOptions {
  /** How close two states must be to count as one node. */
  tol?: ClusterTolerance;
  /** Give up on a leg after expanding this many nodes. */
  nodeCap?: number;
}

// An open A* node: an exact state and the cell it is in.
interface OpenNode {
  state: PlayerState;
  cellR: number;
  cellC: number;
}

/**
 * The default planning strategy. A* nodes carry the player's exact
 * physics state, and edges are made on demand by simulating actions from
 * that state (PerFrameExpander), so there is no bucketing and the plan
 * replays on the engine exactly as predicted. Nearly identical states
 * are merged (StateCluster) to keep the search finite.
 *
 * Pickups are visited nearest first (by cell distance), then the exit.
 * Steps listed in `options.blocked` (ids "fromR,fromC>toR,toC:kind", see
 * `stepId`) are never taken, which is how LevelTester finds alternative
 * routes and replans around a step that failed in replay.
 */
export class PerFramePlanner extends Planner {
  static readonly DEFAULT_NODE_CAP = 100_000;

  readonly kind = PlannerKind.PerFrame;
  private readonly tol: ClusterTolerance;
  private readonly nodeCap: number;

  constructor(adapter: PhysicsAdapter, options: PerFramePlannerOptions = {}) {
    super(adapter);
    this.tol = options.tol ?? StateCluster.DEFAULT_TOLERANCE;
    this.nodeCap = options.nodeCap ?? PerFramePlanner.DEFAULT_NODE_CAP;
  }

  plan(parsed: ParsedLevel, legend: LegendRecord | null, options: PlanOptions = {}): Plan {
    const tileset = options.tileset ?? null;
    const blocked = options.blocked ?? new Set<string>();
    const layout = new LevelGrid(parsed, legend).findLayout();
    const { start, pickupCells, exitCells } = layout;
    if (!start || exitCells.length === 0) {
      return Plan.empty(null);
    }
    const goals = PerFramePlanner.orderGoals(parsed, layout, start);

    const expander = new PerFrameExpander(this.adapter, parsed, legend, tileset, {
      exitCells,
      precisionTargets: [...pickupCells, ...exitCells],
    });
    const builder = new PlanBuilder();
    let state: PlayerState = {
      x: start.c * TILE, y: start.r * TILE, vx: 0, vy: 0, onGround: true,
    };

    const unreachable: UnreachableGoal[] = [];
    for (const goal of goals) {
      const { r: gr, c: gc } = CellKey.parse(goal);
      const path = this.findPath(expander, state, goal, blocked);
      const subgoalName = Planner.describeGoal(goal, layout, 'target ');
      if (!path) {
        const isExit = exitCells.some((e) => e.r === gr && e.c === gc);
        if (isExit) {
          // Returned as is: unlike the bucket planner, no final key release.
          return builder.build(layout, goals, [...unreachable, { r: gr, c: gc, kind: GoalKind.Exit }]);
        }
        unreachable.push({ r: gr, c: gc, kind: GoalKind.Pickup });
        continue;
      }
      state = this.writeLeg(builder, path, subgoalName, state);
    }

    // Let go of the last direction so the player doesn't walk on past the exit.
    builder.releaseHeldDirection();
    return builder.build(layout, goals, unreachable);
  }

  /**
   * The id of a step from cell `from` along `edge`: "fromR,fromC>toR,toC:kind",
   * the same "from>to:kind" shape as the bucket planner's edge ids. Blocking
   * an id rules out that kind of move between those two cells.
   */
  static stepId(from: Cell, edge: PerFrameEdge): string {
    return `${from.r},${from.c}>${edge.toCell.r},${edge.toCell.c}:${edge.kind}`;
  }

  /**
   * A* from exactly `fromState` to any state in the cell `goalCellKey`
   * ("r,c"), never taking a step whose `stepId` is in `blocked`. Returns
   * the steps (empty if already there), or null if the goal wasn't
   * reached within the node cap.
   */
  findPath(
    expander: PerFrameExpander,
    fromState: PlayerState,
    goalCellKey: string,
    blocked: ReadonlySet<string> = new Set(),
  ): PerFrameStep[] | null {
    const tol = this.tol;
    const { r: tr, c: tc } = CellKey.parse(goalCellKey);
    const matchesGoal = (cellR: number, cellC: number) => cellR === tr && cellC === tc;

    const { r: fromR, c: fromC } = LevelGrid.cellAt(fromState);
    if (matchesGoal(fromR, fromC)) return [];

    const startCK = StateCluster.keyOf(fromState, tol);
    const open = new Map<string, OpenNode>();   // cluster key → node
    open.set(startCK, { state: fromState, cellR: fromR, cellC: fromC });
    const gScore = new Map([[startCK, 0]]);
    const fScore = new Map([[startCK, PerFramePlanner.heuristic(fromR, fromC, tr, tc)]]);
    const cameFrom = new Map<string, PerFrameStep>();

    let expanded = 0;
    while (open.size > 0 && expanded < this.nodeCap) {
      // The open node with the lowest f-score (the first one on a tie).
      let curCK: string | null = null;
      let curBest = Infinity;
      for (const ck of open.keys()) {
        const f = fScore.get(ck) ?? Infinity;
        if (f < curBest) { curBest = f; curCK = ck; }
      }
      const curNode = open.get(curCK!)!;
      open.delete(curCK!);
      expanded++;

      if (matchesGoal(curNode.cellR, curNode.cellC)) {
        const path: PerFrameStep[] = [];
        let ck = curCK!;
        while (cameFrom.has(ck)) {
          const { from, edge, fromState: legStart, fromCell } = cameFrom.get(ck)!;
          path.unshift({ from, edge, fromState: legStart, fromCell });
          ck = from;
        }
        return path;
      }

      const edges = expander.expand(curNode.state);
      // A fixed order, so equally good edges always break ties the same way.
      edges.sort((a, b) => a.action.sortKey.localeCompare(b.action.sortKey));

      const curG = gScore.get(curCK!) ?? Infinity;
      const curCell = { r: curNode.cellR, c: curNode.cellC };
      for (const edge of edges) {
        if (blocked.size > 0 && blocked.has(PerFramePlanner.stepId(curCell, edge))) continue;
        const nextCK = StateCluster.keyOf(edge.toState, tol);
        const tentative = curG + edge.cost;
        if (tentative < (gScore.get(nextCK) ?? Infinity)) {
          cameFrom.set(nextCK, { from: curCK!, edge, fromState: curNode.state, fromCell: curCell });
          gScore.set(nextCK, tentative);
          fScore.set(nextCK, tentative + PerFramePlanner.heuristic(edge.toCell.r, edge.toCell.c, tr, tc));
          open.set(nextCK, {
            state: edge.toState,
            cellR: edge.toCell.r,
            cellC: edge.toCell.c,
          });
        }
      }
    }
    return null;
  }

  // The goal queue: the required number of pickups, each the nearest (by
  // cell distance) to the previous one, then the first exit.
  private static orderGoals(parsed: ParsedLevel, layout: LevelLayout, start: { r: number; c: number }): string[] {
    const { pickupCells, exitCells } = layout;
    const pickupRequired = parsed?.meta?.pickupRequired ?? 'all';
    const exitKey = CellKey.of(exitCells[0].r, exitCells[0].c);
    let need: number;
    if (pickupRequired === 'all') need = pickupCells.length;
    else if (pickupRequired === 0) need = 0;
    else need = Math.min(pickupRequired, pickupCells.length);

    const goals: string[] = [];
    let curState = {
      x: start.c * TILE, y: start.r * TILE, vx: 0, vy: 0, onGround: true,
    };
    const remaining = pickupCells.map((p) => CellKey.of(p.r, p.c));
    for (let i = 0; i < need; i++) {
      let bestKey: string | null = null;
      let bestDist = Infinity;
      const { r: curR, c: curC } = LevelGrid.cellAt(curState);
      for (const k of remaining) {
        const { r, c } = CellKey.parse(k);
        const d = Math.abs(r - curR) + Math.abs(c - curC);
        if (d < bestDist) { bestDist = d; bestKey = k; }
      }
      if (!bestKey) break;
      goals.push(bestKey);
      remaining.splice(remaining.indexOf(bestKey), 1);
      const { r, c } = CellKey.parse(bestKey);
      curState = { x: c * TILE, y: r * TILE, vx: 0, vy: 0, onGround: true };
    }
    goals.push(exitKey);
    return goals;
  }

  // Record a leg's steps and return the exact state it ends in. The
  // states are exact, so each step costs just what the search predicted.
  // The held direction carries over between legs.
  private writeLeg(builder: PlanBuilder, steps: PerFrameStep[], subgoalName: string, state: PlayerState): PlayerState {
    for (const step of steps) {
      const edge = step.edge;
      const action = edge.action;
      builder.holdDirection(edge.dir);

      // Let go of the direction exactly when the simulated action did, or
      // the player would keep moving past the predicted landing.
      if (action instanceof JumpAction) {
        builder.tapJump();
        builder.releaseDirectionAfter(action.holdFrames, edge.cost);
      } else if (action instanceof DropAction) {
        builder.releaseDirectionAfter(DropAction.HOLD_FRAMES_BUDGET, edge.cost);
      } else if (action instanceof DropReleaseAction) {
        builder.releaseDirectionAfter(action.releaseFrame, edge.cost);
      } else if (action instanceof RunOffAction) {
        builder.releaseDirectionAfter(
          action.walkCells * WalkAction.FRAMES_PER_CELL + DropAction.HOLD_FRAMES_BUDGET,
          edge.cost,
        );
      }

      builder.addStep(
        edge.kind,
        { r: edge.toCell.r, c: edge.toCell.c },
        PerFramePlanner.explain(edge, subgoalName),
        edge.cost,
        PerFramePlanner.stepId(step.fromCell, edge),
      );
      state = { ...edge.endState };
    }
    return state;
  }

  // Manhattan cell distance times the one-cell walk cost: admissible,
  // since no action covers a cell faster than walking.
  private static heuristic(rA: number, cA: number, rB: number, cB: number): number {
    return (Math.abs(rA - rB) + Math.abs(cA - cB)) * WalkAction.FRAMES_PER_CELL;
  }

  // The trace's "why" text for a step, e.g. "jump right toward exit at (9,3)".
  private static explain(edge: PerFrameEdge, subgoalName: string): string {
    return `${edge.kind} ${edge.dir ?? ''} toward ${subgoalName}`.trim().replace(/\s+/g, ' ');
  }
}
