import { Action } from './Action.ts';
import { ActionKind } from './ActionKind.ts';
import type { Recording } from './RecordingEvent.ts';

/** Press nothing for a number of frames (lets a fall settle). */
export class WaitAction extends Action {
  readonly kind = ActionKind.Wait;

  constructor(readonly frames: number) {
    super();
  }

  get nominalCost(): number {
    return this.frames;
  }

  // Only time passes: no key events.
  toRecording(_frameStart = 0): Recording {
    return [];
  }

  describe(_subgoalName = ''): string {
    return `wait ${this.frames} frame${this.frames === 1 ? '' : 's'}`;
  }
}
