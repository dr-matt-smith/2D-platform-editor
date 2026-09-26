/**
 * The kinds of action the player can execute. The values appear in plan
 * traces, edge ids ("from>to:kind") and the CLI's JSON output.
 */
export enum ActionKind {
  /** Hold a direction for a number of cells. */
  Walk = 'walk',
  /** Jump, holding a direction until a chosen frame. */
  Jump = 'jump',
  /** Walk off a ledge, holding the direction through the fall. */
  Drop = 'drop',
  /** Walk off a ledge and let go of the direction mid-fall. */
  DropRelease = 'drop_release',
  /** Walk some cells, then carry that speed off a ledge. */
  RunOff = 'run_off',
  /** Hold nothing for a number of frames. */
  Wait = 'wait',
}
