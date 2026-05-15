import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './level.js';
import { validate } from './validate.js';

const find = (issues, re) => issues.find((i) => re.test(i.message));

test('a valid level produces no errors', () => {
  const issues = validate(parse('####\n#PE#\n####'));
  assert.equal(issues.filter((i) => i.severity === 'error').length, 0);
});

test('two P spawns: extra one flagged with its line/col', () => {
  const issues = validate(parse('P..\n..P'));
  const extra = find(issues, /extra player spawn/);
  assert.ok(extra);
  assert.equal(extra.line, 2);
  assert.equal(extra.col, 3);
});

test('missing player spawn is an error', () => {
  assert.ok(find(validate(parse('###\n#E#')), /no player spawn/));
});

test('undefined glyph reported at line/col', () => {
  const issues = validate(parse('# size: 3x1\n#Z#'));
  const bad = find(issues, /undefined glyph 'Z'/);
  assert.ok(bad);
  assert.equal(bad.line, 2);
  assert.equal(bad.col, 2);
});

test('declared size mismatch is an error', () => {
  const issues = validate(parse('# size: 3x5\nP##'));
  assert.ok(find(issues, /declared height 5 but found 1/));
});

test('missing exit is a warning, not an error', () => {
  const issues = validate(parse('P..'));
  const e = find(issues, /no exit/);
  assert.equal(e.severity, 'warn');
});
