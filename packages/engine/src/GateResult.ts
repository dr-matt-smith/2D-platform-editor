import type { ValidationIssue } from '@2d-platform/level-format';

// Whether a level may be played, and if not, why.
export interface GateResult {
  ok: boolean;
  // The blocking issues, in the validator's issue shape (empty when ok).
  reasons: ValidationIssue[];
}
