import type { ActionOutcome } from './ActionOutcome.ts';
import type { Cell } from './Cell.ts';
import type { PlayerState, Point, Velocity } from './PlayerState.ts';

/** Where one simulated action left the player (see ActionSimulator). */
export interface ActionResult {
  outcome: ActionOutcome;
  /** AABB top-left. */
  endPos: Point;
  /** The cell containing the AABB centre. */
  endCell: Cell;
  endVel: Velocity;
  /** The exact end state — a following simulation can start from it. */
  endState: PlayerState;
  /** AABB top-left after every frame; null unless `collectTrajectory` was set. */
  trajectory: Point[] | null;
  /** Did the player push against a wall (moving but not getting anywhere)? */
  collided: boolean;
  /** Frames the action actually took. */
  cost: number;
}

/** Options for ActionSimulator.simulate. */
export interface SimulateActionOptions {
  /** Record the player's position after every frame (for precision landings). */
  collectTrajectory?: boolean;
}
