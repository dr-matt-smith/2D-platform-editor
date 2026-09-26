/** How one simulated action ended. */
export enum ActionOutcome {
  /** Finished standing on something. */
  Ok = 'ok',
  /** Finished still in the air. */
  MidAir = 'mid-air',
  /** The player died (hazard, or fell out of the level). */
  Dead = 'dead',
  /** The player won (reached an exit with enough pickups). */
  Won = 'won',
}
