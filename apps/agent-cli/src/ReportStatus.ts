// How a level's run ended. The values are the `status` strings in the
// JSON report.
export enum ReportStatus {
  // The agent found at least one solution.
  Solved = 'solved',
  // The agent ran but found no solution within the budget.
  Unsolved = 'unsolved',
  // Validation failed, so the agent was not run.
  Invalid = 'invalid',
}
