import type { FailureReason } from './FailureReason.ts';
import type { Plan } from './Plan.ts';
import type { SimResult } from './Simulator.ts';
import type { Solution } from './Solution.ts';

/** The level can be solved. */
export interface LevelTestSuccess {
  ok: true;
  /** Up to 5 distinct solutions, fewest frames first. */
  solutions: Solution[];
  /** The best solution (`solutions[0]`). */
  solution: Solution;
}

/** No solution was found. */
export interface LevelTestFailure {
  ok: false;
  /** The last plan tried (its `unreachable` explains a blocked exit). */
  lastPlan: Plan;
  /** How the last replay ended, if there was one. */
  lastSim: SimResult | null;
  attempts: number;
  reason?: FailureReason;
}

/** What LevelTester.test returns; check `ok` to tell which. */
export type LevelTestResult = LevelTestSuccess | LevelTestFailure;
