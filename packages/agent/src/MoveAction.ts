import { Action } from './Action.ts';
import type { Direction } from './Direction.ts';

/**
 * An action that holds a direction key — every action except waiting.
 * These are the candidates the planner tries from each state.
 */
export abstract class MoveAction extends Action {
  protected constructor(readonly dir: Direction) {
    super();
  }

  /**
   * A stable key for breaking ties between equally good edges: kind,
   * direction, then the jump hold, drop release and run-off walk lengths
   * (blank when the action has none).
   */
  get sortKey(): string {
    return [this.kind, this.dir, ...this.sortParams()].join('|');
  }

  /** [holdFrames, releaseFrame, walkCells] as strings; subclasses fill in theirs. */
  protected sortParams(): [string, string, string] {
    return ['', '', ''];
  }
}
