import type { ValidationIssue } from '@2d-platform/level-format';
import type { StartStatus } from './StartStatus.ts';

// What `PlaySession.start` resolves to. Only a refused level carries data:
// the reasons the launch gate gave.
export type StartResult =
  | { status: StartStatus.Playing }
  | { status: StartStatus.Invalid; reasons: ValidationIssue[] }
  | { status: StartStatus.Cancelled };
