// The counts behind an --all sweep, as plain data: the `summary` object in
// the `--all --json` output.
export interface SweepTotals {
  total: number;
  solved: number;
  unsolved: number;
  invalid: number;
  // Search time summed over the levels the agent ran on.
  elapsedMs: number;
  // Ids (or names) of the levels that were not solved.
  failed: string[];
}
