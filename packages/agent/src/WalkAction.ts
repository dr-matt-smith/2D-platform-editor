import { ActionKind } from './ActionKind.ts';
import { MoveAction } from './MoveAction.ts';
import type { Direction } from './Direction.ts';
import type { Recording } from './RecordingEvent.ts';

/** Hold a direction for a whole number of cells, then let go. */
export class WalkAction extends MoveAction {
  /** Frames to walk one cell: TILE 20 / (SPEED 240 / 60) = 5. */
  static readonly FRAMES_PER_CELL = 5;

  readonly kind = ActionKind.Walk;

  constructor(dir: Direction, readonly cells: number) {
    super(dir);
  }

  get nominalCost(): number {
    return this.cells * WalkAction.FRAMES_PER_CELL;
  }

  // Hold the direction at the start and release it `cells * 5` frames later.
  toRecording(frameStart = 0): Recording {
    const end = frameStart + this.cells * WalkAction.FRAMES_PER_CELL;
    return [
      { frame: frameStart, key: this.dir, down: true },
      { frame: end, key: this.dir, down: false },
    ];
  }

  describe(subgoalName = ''): string {
    const noun = this.cells === 1 ? 'cell' : 'cells';
    return `walk ${this.dir} ${this.cells} ${noun}${WalkAction.toward(subgoalName)}`;
  }
}
