/** How a replayed recording ended. */
export enum SimOutcome {
  Won = 'won',
  Dead = 'dead',
  /** The frame budget ran out first. */
  Timeout = 'timeout',
}
