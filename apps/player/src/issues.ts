// Turn the engine's launch-gate reasons into readable sentences.
import type { ValidationIssue } from '@2d-platform/level-format';

// e.g. "Line 3, column 7: unknown glyph 'Q'". Issues about the level as a
// whole (no spawn, no exit) are reported at line 1, column 1.
export function describeIssue({ line, col, message }: ValidationIssue): string {
  return `Line ${line}, column ${col}: ${message}`;
}
