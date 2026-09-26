import { GRAVITY, JUMP_FORCE } from './constants.ts';
import { ActionKind } from './ActionKind.ts';
import { MoveAction } from './MoveAction.ts';
import type { Direction } from './Direction.ts';
import type { Recording } from './RecordingEvent.ts';

/**
 * Jump while holding a direction, and let go of the direction after
 * `holdFrames` frames. Letting go mid-arc caps the horizontal travel, which
 * is how the player lands precisely on a small platform instead of
 * overshooting it.
 */
export class JumpAction extends MoveAction {
  /** A full jump arc in frames (2 * JUMP_FORCE / GRAVITY * 60 = 42). */
  static readonly ARC_FRAMES: number = Math.round((2 * JUMP_FORCE) / GRAVITY * 60);

  readonly kind = ActionKind.Jump;

  constructor(dir: Direction, readonly holdFrames: number) {
    super(dir);
  }

  // The canonical cost is the full arc; the real landing may come sooner
  // (a higher platform) or later (a lower one), and the simulator decides.
  get nominalCost(): number {
    return JumpAction.ARC_FRAMES;
  }

  override get leavesGround(): boolean {
    return true;
  }

  // Direction and space down together, space up one frame later (a tap),
  // direction up at `holdFrames`.
  toRecording(frameStart = 0): Recording {
    return [
      { frame: frameStart, key: this.dir, down: true },
      { frame: frameStart, key: 'space', down: true },
      { frame: frameStart + 1, key: 'space', down: false },
      { frame: frameStart + this.holdFrames, key: this.dir, down: false },
    ];
  }

  describe(subgoalName = ''): string {
    return `jump ${this.dir} (release at frame ${this.holdFrames})${JumpAction.toward(subgoalName)}`;
  }

  protected override sortParams(): [string, string, string] {
    return [String(this.holdFrames), '', ''];
  }
}
