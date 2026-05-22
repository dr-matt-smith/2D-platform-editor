import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import { testLevel } from './runner.js';

test('runner: trivial walk-to-exit succeeds in 1 attempt', () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const r = testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
  assert.equal(r.solution.stats.attempts, 1);
  assert.ok(r.solution.stats.steps > 0);
});

test('runner: # pickup-required: 0 → exit-direct level wins', () => {
  // Note the # before pickup-required so it's a directive, not a wall.
  const parsed = parse('# pickup-required: 0\n#######\n#P.o.E#\n#######');
  const r = testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
});

test('runner: pickup-required all → solution collects coin first', () => {
  const parsed = parse('#######\n#P.o.E#\n#######');
  const r = testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
  assert.equal(r.solution.stats.score, 1);
});

test('runner: unreachable exit → ok: false, attempts === 0', () => {
  // Disconnected platforms with a void wider than 8-cell jump reach.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const parsed = parse(text);
  const r = testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, false);
  assert.equal(r.attempts, 0);
  assert.ok(r.lastPlan.unreachable.some((u) => u.kind === 'exit'));
});

test('runner: solution carries enough info for the dialog UI', () => {
  // Smoke shape-check: the dialog needs solution.plan.trace +
  // solution.recording + solution.stats.
  const parsed = parse('#####\n#P.E#\n#####');
  const r = testLevel(parsed, DEFAULT_LEGEND, null);
  assert.ok(r.solution.plan);
  assert.ok(Array.isArray(r.solution.plan.trace));
  assert.ok(Array.isArray(r.solution.recording));
  assert.ok(r.solution.stats);
  assert.ok(typeof r.solution.stats.frame === 'number');
});
