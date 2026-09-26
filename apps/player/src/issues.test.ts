import { assertEquals } from '@std/assert';
import { describeIssue } from './issues.ts';

Deno.test('describeIssue prefixes the message with its position', () => {
  const issue = { line: 3, col: 7, severity: 'error' as const, message: 'no exit (E)' };
  assertEquals(describeIssue(issue), 'Line 3, column 7: no exit (E)');
});
