import type { ActionKind } from './ActionKind.ts';
import type { Recording } from './RecordingEvent.ts';

/**
 * Something the player can physically do: a short, fixed pattern of key
 * presses. Every edge the planner searches over is one action, and the
 * physics simulator — not the action — decides where it ends up.
 *
 * Each subclass knows how long it lasts, which keys it presses, and how
 * to explain itself, so callers never switch on the kind.
 */
export abstract class Action {
  /** Which kind of action this is. */
  abstract readonly kind: ActionKind;

  /**
   * How many frames the action's key pattern lasts. For actions that
   * leave the ground this is only the hold window; the simulator reports
   * the real cost when the player lands.
   */
  abstract get nominalCost(): number;

  /** True when the action can leave the ground (the simulator then stops on landing). */
  get leavesGround(): boolean {
    return false;
  }

  /** The action's key events, starting at `frameStart`. */
  abstract toRecording(frameStart?: number): Recording;

  /** A readable description, e.g. "jump left (release at frame 26) toward exit". */
  abstract describe(subgoalName?: string): string;

  /** " toward <subgoal>", or nothing without a subgoal. */
  protected static toward(subgoalName: string): string {
    return subgoalName ? ` toward ${subgoalName}` : '';
  }
}
