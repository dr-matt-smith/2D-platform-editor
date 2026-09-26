import { ActionKind } from './ActionKind.ts';
import { DropAction } from './DropAction.ts';
import { MoveAction } from './MoveAction.ts';
import type { Direction } from './Direction.ts';
import type { Recording } from './RecordingEvent.ts';

/**
 * Walk off a ledge and let go of the direction at `releaseFrame`, so the
 * rest of the fall is straight down — the drop's version of releasing
 * mid-jump. It lands differently from a plain drop, especially across
 * narrow gaps.
 */
export class DropReleaseAction extends MoveAction {
  readonly kind = ActionKind.DropRelease;

  constructor(dir: Direction, readonly releaseFrame: number) {
    super(dir);
  }

  // The post-release fall gets the same budget as a plain drop.
  get nominalCost(): number {
    return DropAction.HOLD_FRAMES_BUDGET;
  }

  override get leavesGround(): boolean {
    return true;
  }

  toRecording(frameStart = 0): Recording {
    return [
      { frame: frameStart, key: this.dir, down: true },
      { frame: frameStart + this.releaseFrame, key: this.dir, down: false },
    ];
  }

  describe(subgoalName = ''): string {
    return `drop ${this.dir} (release at frame ${this.releaseFrame})${DropReleaseAction.toward(subgoalName)}`;
  }

  protected override sortParams(): [string, string, string] {
    return ['', String(this.releaseFrame), ''];
  }
}
