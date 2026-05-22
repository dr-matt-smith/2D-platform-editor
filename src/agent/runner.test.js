import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, DEFAULT_LEGEND } from '../level.js';
import { testLevel } from './runner.js';

test('runner: trivial walk-to-exit succeeds in 1 attempt', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
  assert.equal(r.solution.stats.attempts, 1);
  assert.ok(r.solution.stats.steps > 0);
});

test('runner: # pickup-required: 0 → exit-direct level wins', async () => {
  const parsed = parse('# pickup-required: 0\n#######\n#P.o.E#\n#######');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
});

test('runner: pickup-required all → solution collects coin first', async () => {
  const parsed = parse('#######\n#P.o.E#\n#######');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, true);
  assert.equal(r.solution.stats.score, 1);
});

test('runner: unreachable exit → ok: false, attempts === 0', async () => {
  // Disconnected platforms with a void wider than 8-cell jump reach.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const parsed = parse(text);
  const r = await testLevel(parsed, DEFAULT_LEGEND, null);
  assert.equal(r.ok, false);
  assert.equal(r.attempts, 0);
  assert.ok(r.lastPlan.unreachable.some((u) => u.kind === 'exit'));
});

test('runner: solution carries enough info for the dialog UI', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null);
  assert.ok(r.solution.plan);
  assert.ok(Array.isArray(r.solution.plan.trace));
  assert.ok(Array.isArray(r.solution.recording));
  assert.ok(r.solution.stats);
  assert.ok(typeof r.solution.stats.frame === 'number');
});

test('runner: onProgress callback fires at least once', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const progressCalls = [];
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, {
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assert.equal(r.ok, true);
  assert.ok(progressCalls.length >= 1, 'onProgress should fire at least once');
  assert.ok(progressCalls[0].total === 5000, 'default budget is 5000ms');
});

test('runner: maxRuntimeMs option overrides the default budget', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const progressCalls = [];
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, {
    maxRuntimeMs: 10000,
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assert.equal(r.ok, true);
  // Trivial level wins fast — but the budget reported should be 10000.
  assert.ok(progressCalls.every((p) => p.total === 10000));
});

test('runner: signal.abort() interrupts the search', async () => {
  // A deliberately unsolvable level (player + exit on disconnected
  // void platforms). With no signal, the runner returns ok: false
  // quickly. With a pre-aborted signal, ditto — but the path through
  // the loop differs and exercises the abort handling.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const parsed = parse(text);
  const ac = new AbortController();
  ac.abort();
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { signal: ac.signal });
  assert.equal(r.ok, false);
});
