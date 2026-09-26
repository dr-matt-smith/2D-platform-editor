import type { ActionKind } from './ActionKind.ts';
import type { Cell } from './Cell.ts';

/**
 * One explained step of a plan — what the editor's dialog lists and the
 * CLI prints. Plain data, so it serialises to JSON as-is.
 */
export interface TraceEntry {
  kind: ActionKind;
  /** The cell the step heads for. */
  target: Cell;
  /** Why: e.g. "jump right toward pickup #2 at (5,8)". */
  why: string;
  /** [startFrame, endFrame) of the step within the recording. */
  frameRange: [number, number];
  /** "from>to:kind" — what a replan blocks to find a different route. */
  edgeId: string;
}
