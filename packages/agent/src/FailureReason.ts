/** Why a level test stopped early, when it did. */
export enum FailureReason {
  /** The time budget ran out while the first plan was being made. */
  TimeoutDuringPlan = 'timeout-during-plan',
}
