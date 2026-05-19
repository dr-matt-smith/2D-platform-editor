import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../level.js';
import { validate } from '../validate.js';
import { playtestGate } from './playtestGate.js';

test('a clean level (one P, an E, no errors) is launchable', () => {
  const g = playtestGate(parse('#####\n#P.E#\n#####'));
  assert.equal(g.ok, true);
  assert.deepEqual(g.reasons, []);
});

test('an undefined glyph blocks launch', () => {
  const g = playtestGate(parse('P.E\n.Z.'));
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => /undefined glyph/.test(r.message)));
});

test('two player spawns block launch', () => {
  const g = playtestGate(parse('P.P\n..E'));
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => /extra player spawn/.test(r.message)));
});

test('no player spawn blocks launch', () => {
  const g = playtestGate(parse('...\n..E'));
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => /no player spawn/.test(r.message)));
});

test('missing E blocks playtest even though validate only WARNS for it', () => {
  const parsed = parse('#####\n#P..#\n#####');
  // The editor lint treats a missing exit as a non-blocking warning …
  const issues = validate(parsed);
  assert.equal(
    issues.filter((i) => i.severity === 'error').length,
    0,
    'no validator errors for this level',
  );
  assert.ok(issues.some((i) => i.severity === 'warn' && /no exit/.test(i.message)));
  // … but the play gate promotes it to a blocker (stricter, by design §4.1).
  const g = playtestGate(parsed);
  assert.equal(g.ok, false);
  assert.ok(g.reasons.some((r) => /needs an exit/.test(r.message)));
});

test('reasons use the validator issue shape (line/col/severity/message)', () => {
  const g = playtestGate(parse('...'));
  for (const r of g.reasons) {
    assert.equal(typeof r.line, 'number');
    assert.equal(typeof r.col, 'number');
    assert.equal(r.severity, 'error');
    assert.equal(typeof r.message, 'string');
  }
});
