import { assertEquals } from '@std/assert';
import { Severity } from '@2d-platform/level-format';
import { MessagePanel } from './MessagePanel.ts';

Deno.test('describeIssue prefixes the message with its position', () => {
  const issue = { line: 3, col: 7, severity: Severity.Error, message: 'no exit (E)' };
  assertEquals(MessagePanel.describeIssue(issue), 'Line 3, column 7: no exit (E)');
});
