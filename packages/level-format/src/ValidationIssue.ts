import type { Severity } from './Severity.ts';

// One problem found in a level. `line` and `col` are 1-based and point
// into the original text; issues about the level as a whole (no player,
// no exit) are reported at line 1, column 1.
export interface ValidationIssue {
  line: number;
  col: number;
  severity: Severity;
  message: string;
}
