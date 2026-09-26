import { ActionKind } from './ActionKind.ts';
import { MoveAction } from './MoveAction.ts';
import type { Direction } from './Direction.ts';
import type { Recording } from './RecordingEvent.ts';

/** Walk off a ledge and keep holding the direction until landing. */
export class DropAction extends MoveAction {
  /**
   * The longest a drop holds its direction, in frames. The simulator
   * measures the real fall; this only bounds the recording.
   */
  static readonly HOLD_FRAMES_BUDGET = 60;

  readonly kind = ActionKind.Drop;

  constructor(dir: Direction) {
    super(dir);
  }

  get nominalCost(): number {
    return DropAction.HOLD_FRAMES_BUDGET;
  }

  override get leavesGround(): boolean {
    return true;
  }

  toRecording(frameStart = 0): Recording {
    return [
      { frame: frameStart, key: this.dir, down: true },
      { frame: frameStart + DropAction.HOLD_FRAMES_BUDGET, key: this.dir, down: false },
    ];
  }

  describe(subgoalName = ''): string {
    return `drop off ledge ${this.dir}${DropAction.toward(subgoalName)}`;
  }
}
