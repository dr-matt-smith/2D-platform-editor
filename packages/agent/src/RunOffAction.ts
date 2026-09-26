import { ActionKind } from './ActionKind.ts';
import { DropAction } from './DropAction.ts';
import { MoveAction } from './MoveAction.ts';
import { WalkAction } from './WalkAction.ts';
import type { Direction } from './Direction.ts';
import type { Recording } from './RecordingEvent.ts';

/**
 * Walk `walkCells` cells and keep holding the direction, carrying the
 * walking speed into a fall if the platform ends. Where the player steps
 * off is decided by the level's geometry, not the recording; with no
 * ledge it is simply a long walk.
 */
export class RunOffAction extends MoveAction {
  readonly kind = ActionKind.RunOff;

  constructor(dir: Direction, readonly walkCells: number) {
    super(dir);
  }

  // The walk plus a drop's fall budget; the simulator decides the real cost.
  get nominalCost(): number {
    return this.walkCells * WalkAction.FRAMES_PER_CELL + DropAction.HOLD_FRAMES_BUDGET;
  }

  override get leavesGround(): boolean {
    return true;
  }

  // One continuous hold covering the walk and the fall.
  toRecording(frameStart = 0): Recording {
    const total = this.walkCells * WalkAction.FRAMES_PER_CELL + DropAction.HOLD_FRAMES_BUDGET;
    return [
      { frame: frameStart, key: this.dir, down: true },
      { frame: frameStart + total, key: this.dir, down: false },
    ];
  }

  describe(subgoalName = ''): string {
    const noun = this.walkCells === 1 ? 'cell' : 'cells';
    return `walk ${this.dir} ${this.walkCells} ${noun} then carry into fall${RunOffAction.toward(subgoalName)}`;
  }

  protected override sortParams(): [string, string, string] {
    return ['', '', String(this.walkCells)];
  }
}
