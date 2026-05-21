import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summariseIssues } from './summarise.js';

test('empty / nullish input → OK / ok', () => {
  assert.deepEqual(summariseIssues([]),         { text: 'OK', severity: 'ok' });
  assert.deepEqual(summariseIssues(undefined),  { text: 'OK', severity: 'ok' });
  assert.deepEqual(summariseIssues(null),       { text: 'OK', severity: 'ok' });
});

test('single error → exact "line:col error message"', () => {
  const r = summariseIssues([
    { line: 3, col: 5, severity: 'error', message: "undefined glyph 'Z'" },
  ]);
  assert.deepEqual(r, {
    text: "3:5 error undefined glyph 'Z'",
    severity: 'error',
  });
});

test('single warning → warn severity', () => {
  const r = summariseIssues([
    { line: 1, col: 1, severity: 'warn', message: 'no exit in level' },
  ]);
  assert.equal(r.severity, 'warn');
  assert.match(r.text, /warn no exit/);
});

test('multiple issues → "+N more" suffix on the head', () => {
  const r = summariseIssues([
    { line: 3, col: 5, severity: 'error', message: 'A' },
    { line: 4, col: 1, severity: 'error', message: 'B' },
    { line: 5, col: 1, severity: 'error', message: 'C' },
  ]);
  assert.equal(r.severity, 'error');
  assert.equal(r.text, '3:5 error A · +2 more');
});

test('errors are prioritised over warnings even when warnings come first', () => {
  const r = summariseIssues([
    { line: 1, col: 1, severity: 'warn',  message: 'no exit in level' },
    { line: 1, col: 1, severity: 'warn',  message: 'second warn' },
    { line: 7, col: 2, severity: 'error', message: 'real problem' },
  ]);
  assert.equal(r.severity, 'error');
  assert.match(r.text, /7:2 error real problem/);
  assert.match(r.text, /\+2 more$/);
});

test('stable within severity: first error in input order wins among equals', () => {
  const r = summariseIssues([
    { line: 1, col: 1, severity: 'error', message: 'first' },
    { line: 2, col: 1, severity: 'error', message: 'second' },
  ]);
  assert.match(r.text, /^1:1 error first/);
});

test('missing line/col/message fields degrade safely (no crash, no NaN)', () => {
  const r = summariseIssues([{ severity: 'warn' }]);
  assert.equal(r.severity, 'warn');
  assert.match(r.text, /\?:\? warn/);
});

test('unknown severity sorts after error/warn but is still presentable', () => {
  const r = summariseIssues([
    { line: 1, col: 1, severity: 'info', message: 'hi' },
    { line: 2, col: 1, severity: 'error', message: 'real' },
  ]);
  // Error sorts ahead of 'info'.
  assert.match(r.text, /^2:1 error real/);
});
