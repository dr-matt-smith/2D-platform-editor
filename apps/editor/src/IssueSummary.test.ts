import { assertEquals, assertMatch } from '@std/assert';
import { IssueSummary } from './IssueSummary.ts';

Deno.test('empty / nullish input → OK / ok', () => {
  assertEquals(IssueSummary.of([]),        new IssueSummary('OK', 'ok'));
  assertEquals(IssueSummary.of(undefined), new IssueSummary('OK', 'ok'));
  assertEquals(IssueSummary.of(null),      new IssueSummary('OK', 'ok'));
});

Deno.test('single error → exact "line:col error message"', () => {
  const r = IssueSummary.of([
    { line: 3, col: 5, severity: 'error', message: "undefined glyph 'Z'" },
  ]);
  assertEquals(r, new IssueSummary("3:5 error undefined glyph 'Z'", 'error'));
});

Deno.test('single warning → warn severity', () => {
  const r = IssueSummary.of([
    { line: 1, col: 1, severity: 'warn', message: 'no exit in level' },
  ]);
  assertEquals(r.severity, 'warn');
  assertMatch(r.text, /warn no exit/);
});

Deno.test('multiple issues → "+N more" suffix on the head', () => {
  const r = IssueSummary.of([
    { line: 3, col: 5, severity: 'error', message: 'A' },
    { line: 4, col: 1, severity: 'error', message: 'B' },
    { line: 5, col: 1, severity: 'error', message: 'C' },
  ]);
  assertEquals(r.severity, 'error');
  assertEquals(r.text, '3:5 error A · +2 more');
});

Deno.test('errors are prioritised over warnings even when warnings come first', () => {
  const r = IssueSummary.of([
    { line: 1, col: 1, severity: 'warn',  message: 'no exit in level' },
    { line: 1, col: 1, severity: 'warn',  message: 'second warn' },
    { line: 7, col: 2, severity: 'error', message: 'real problem' },
  ]);
  assertEquals(r.severity, 'error');
  assertMatch(r.text, /7:2 error real problem/);
  assertMatch(r.text, /\+2 more$/);
});

Deno.test('stable within severity: first error in input order wins among equals', () => {
  const r = IssueSummary.of([
    { line: 1, col: 1, severity: 'error', message: 'first' },
    { line: 2, col: 1, severity: 'error', message: 'second' },
  ]);
  assertMatch(r.text, /^1:1 error first/);
});

Deno.test('missing line/col/message fields degrade safely (no crash, no NaN)', () => {
  const r = IssueSummary.of([{ severity: 'warn' }]);
  assertEquals(r.severity, 'warn');
  assertMatch(r.text, /\?:\? warn/);
});

Deno.test('unknown severity sorts after error/warn but is still presentable', () => {
  const r = IssueSummary.of([
    { line: 1, col: 1, severity: 'info', message: 'hi' },
    { line: 2, col: 1, severity: 'error', message: 'real' },
  ]);
  // Error sorts ahead of 'info'.
  assertMatch(r.text, /^2:1 error real/);
});
