import { TILE } from './constants.ts';
import { ActionCatalog } from './ActionCatalog.ts';
import { ActionOutcome } from './ActionOutcome.ts';
import { ActionSimulator } from './ActionSimulator.ts';
import { LevelGrid } from './LevelGrid.ts';
import type { ActionKind } from './ActionKind.ts';
import type { Cell } from './Cell.ts';
import type { Direction } from './Direction.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { MoveAction } from './MoveAction.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { PlayerState, Point, Velocity } from './PlayerState.ts';
import type { Recording } from './RecordingEvent.ts';

/** An edge found by expanding an exact state; it carries the exact destination state. */
export interface PerFrameEdge {
  /** The destination cell (for the heuristic and goal test). */
  toCell: Cell;
  /** The exact destination state (where the next expansion starts). */
  toState: PlayerState;
  kind: ActionKind;
  cost: number;
  dir: Direction;
  action: MoveAction;
  recording: Recording;
  endPos: Point;
  endVel: Velocity;
  endState: PlayerState;
  isWinEdge: boolean;
  /** Set on precision-landing edges. */
  precision?: boolean;
}

/** One step of a per-frame path: the edge, the cluster key it left, and the exact start state. */
export interface PerFrameStep {
  from: string;
  edge: PerFrameEdge;
  fromState: PlayerState;
  /** The cell the step starts from (part of its step id). */
  fromCell: Cell;
}

/** The targets an expander checks edges against. */
export interface PerFrameTargets {
  /** Exit cells, for spotting edges that win on the way. */
  exitCells?: Cell[];
  /** Pickup and exit cells, for precision landings. */
  precisionTargets?: Cell[];
}

/**
 * Generates the per-frame planner's edges on demand: from an exact
 * state, simulate all 46 candidate actions and keep the ones that land
 * cleanly. No bucketing — each edge carries the exact state it ends in,
 * so a chain of edges replays on the engine exactly as predicted.
 *
 * The expensive scene is built once, on the first expansion, and reused.
 */
export class PerFrameExpander {
  private simulator: ActionSimulator | null = null;
  private readonly grid: LevelGrid;
  private readonly exitCells: Cell[];
  private readonly precisionTargets: Cell[];

  constructor(
    private readonly adapter: PhysicsAdapter,
    private readonly parsed: ParsedLevel,
    private readonly legend: LegendRecord | null,
    private readonly tileset: unknown = null,
    targets: PerFrameTargets = {},
  ) {
    this.grid = new LevelGrid(parsed, legend);
    this.exitCells = targets.exitCells ?? [];
    this.precisionTargets = targets.precisionTargets ?? [];
  }

  /** Has the scene been built yet? (It is built lazily, once.) */
  get hasScene(): boolean {
    return this.simulator !== null;
  }

  /**
   * Every edge reachable from exactly `state`: actions that land on a
   * walkable cell (grounded, unless they win), plus precision-landing
   * edges to pickup or exit cells the arc passes within 2 px of while
   * descending.
   */
  expand(state: PlayerState): PerFrameEdge[] {
    const simulator = this.getSimulator();
    const wantsTrajectory = this.precisionTargets.length > 0;
    const edges: PerFrameEdge[] = [];

    for (const action of ActionCatalog.all()) {
      const result = simulator.simulate(state, action, {
        collectTrajectory: wantsTrajectory,
      });

      let targetR = result.endCell.r;
      let targetC = result.endCell.c;
      let isWinEdge = false;

      if (result.outcome === ActionOutcome.Won) {
        const exit = LevelGrid.exitOverlapping(result.endPos, this.exitCells);
        if (exit) {
          targetR = exit.r;
          targetC = exit.c;
          isWinEdge = true;
        }
      } else if (result.outcome !== ActionOutcome.Ok) {
        continue;
      }

      if (result.collided) continue;
      if (!this.grid.inBounds(targetR, targetC)) continue;
      if (!this.grid.isWalkable(targetR, targetC)) continue;
      if (!isWinEdge && !this.grid.isGrounded(targetR, targetC)) continue;

      edges.push({
        toCell: { r: targetR, c: targetC },
        toState: result.endState,
        kind: action.kind,
        cost: result.cost,
        dir: action.dir,
        action,
        recording: action.toRecording(0),
        endPos: result.endPos,
        endVel: result.endVel,
        endState: result.endState,
        isWinEdge,
      });

      // Precision landings, as in NavGraph, but the edge keeps the exact
      // end state rather than a bucket.
      if (result.trajectory && result.outcome === ActionOutcome.Ok) {
        for (const t of this.precisionTargets) {
          const tcx = t.c * TILE + TILE / 2;
          const tcy = t.r * TILE + TILE / 2;
          if (t.r === targetR && t.c === targetC) continue;
          if (t.r === Math.floor((state.y + TILE / 2) / TILE) &&
              t.c === Math.floor((state.x + TILE / 2) / TILE)) continue;
          let prevY = state.y;
          for (const pt of result.trajectory) {
            const pcx = pt.x + TILE / 2;
            const pcy = pt.y + TILE / 2;
            const descending = pt.y > prevY;
            if (descending && Math.abs(pcx - tcx) <= 2 && Math.abs(pcy - tcy) <= 2) {
              edges.push({
                toCell: { r: t.r, c: t.c },
                toState: result.endState,
                kind: action.kind,
                cost: result.cost,
                dir: action.dir,
                action,
                recording: action.toRecording(0),
                endPos: result.endPos,
                endVel: result.endVel,
                endState: result.endState,
                isWinEdge: false,
                precision: true,
              });
              break;
            }
            prevY = pt.y;
          }
        }
      }
    }
    return edges;
  }

  private getSimulator(): ActionSimulator {
    this.simulator ??= ActionSimulator.create(this.adapter, this.parsed, this.legend, this.tileset);
    return this.simulator;
  }
}
