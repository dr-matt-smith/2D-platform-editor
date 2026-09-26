import { Direction } from './Direction.ts';
import { DropAction } from './DropAction.ts';
import { DropReleaseAction } from './DropReleaseAction.ts';
import { JumpAction } from './JumpAction.ts';
import { RunOffAction } from './RunOffAction.ts';
import { WalkAction } from './WalkAction.ts';
import type { MoveAction } from './MoveAction.ts';

/**
 * The candidate actions the planner tries from every state: 46 in all.
 *
 * Per direction: a one-cell walk, 12 jumps (one per release frame), a
 * drop, 4 drop-and-release variants and 5 run-off lengths — 23, twice.
 * Nothing here checks what is physically possible; the planner simulates
 * each candidate and keeps the ones that land cleanly. Longer walks come
 * from chaining one-cell walks.
 */
export class ActionCatalog {
  /** Frames at which a jump lets go of its direction, spanning the 42-frame arc. */
  static readonly RELEASE_FRAMES: readonly number[] = [2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42];
  /** Frames at which a drop-and-release lets go of its direction. */
  static readonly DROP_RELEASE_FRAMES: readonly number[] = [8, 16, 24, 32];
  /** How many cells a run-off walks before the fall. */
  static readonly RUN_OFF_WALK_CELLS: readonly number[] = [2, 3, 4, 5, 6];

  // Actions are immutable, so one shared list serves every expansion.
  private static cached: readonly MoveAction[] | null = null;

  private constructor() {}

  /**
   * Every candidate, in the fixed order the planner relies on: all of the
   * left actions, then all of the right. The order breaks ties in the
   * search, so changing it changes the plans.
   */
  static all(): readonly MoveAction[] {
    ActionCatalog.cached ??= ActionCatalog.build();
    return ActionCatalog.cached;
  }

  private static build(): readonly MoveAction[] {
    const actions: MoveAction[] = [];
    for (const dir of [Direction.Left, Direction.Right]) {
      actions.push(new WalkAction(dir, 1));
      for (const holdFrames of ActionCatalog.RELEASE_FRAMES) {
        actions.push(new JumpAction(dir, holdFrames));
      }
      actions.push(new DropAction(dir));
      for (const releaseFrame of ActionCatalog.DROP_RELEASE_FRAMES) {
        actions.push(new DropReleaseAction(dir, releaseFrame));
      }
      for (const walkCells of ActionCatalog.RUN_OFF_WALK_CELLS) {
        actions.push(new RunOffAction(dir, walkCells));
      }
    }
    return Object.freeze(actions);
  }
}
