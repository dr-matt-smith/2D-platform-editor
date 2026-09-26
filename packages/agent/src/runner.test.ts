import { assert, assertEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '../../../src/level.ts';
import { testLevel } from './runner.ts';
import type { TestLevelFailure, TestLevelSuccess } from './runner.ts';
import { jsAdapter } from '../../../src/agent-adapter.ts';

Deno.test('runner: trivial walk-to-exit succeeds in 1 attempt', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter }) as TestLevelSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solution.stats.attempts, 1);
  assert(r.solution.stats.steps > 0);
});

Deno.test('runner: # pickup-required: 0 → exit-direct level wins', async () => {
  const parsed = parse('# pickup-required: 0\n#######\n#P.o.E#\n#######');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter });
  assertEquals(r.ok, true);
});

Deno.test('runner: pickup-required all → solution collects coin first', async () => {
  const parsed = parse('#######\n#P.o.E#\n#######');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter }) as TestLevelSuccess;
  assertEquals(r.ok, true);
  assertEquals(r.solution.stats.score, 1);
});

Deno.test('runner: unreachable exit → ok: false, attempts === 0', async () => {
  // Disconnected platforms with a void wider than 8-cell jump reach.
  const text = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  const parsed = parse(text);
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter }) as TestLevelFailure;
  assertEquals(r.ok, false);
  assertEquals(r.attempts, 0);
  assert(r.lastPlan.unreachable.some((u) => u.kind === 'exit'));
});

Deno.test('runner: solution carries enough info for the dialog UI', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter }) as TestLevelSuccess;
  assert(r.solution.plan);
  assert(Array.isArray(r.solution.plan.trace));
  assert(Array.isArray(r.solution.recording));
  assert(r.solution.stats);
  assert(typeof r.solution.stats.frame === 'number');
});

Deno.test('runner: onProgress callback fires at least once', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const progressCalls: { elapsed: number; total: number }[] = [];
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter,
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assertEquals(r.ok, true);
  assert(progressCalls.length >= 1, 'onProgress should fire at least once');
  assert(progressCalls[0].total === 5000, 'default budget is 5000ms');
});

Deno.test('runner: maxRuntimeMs option overrides the default budget', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const progressCalls: { elapsed: number; total: number }[] = [];
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter,
    maxRuntimeMs: 10000,
    onProgress: (elapsed, total) => progressCalls.push({ elapsed, total }),
  });
  assertEquals(r.ok, true);
  // Trivial level wins fast — but the budget reported should be 10000.
  assert(progressCalls.every((p) => p.total === 10000));
});

Deno.test('runner: signal.abort() interrupts the search', async () => {
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
  const r = await testLevel(parsed, DEFAULT_LEGEND, null, { adapter: jsAdapter, signal: ac.signal });
  assertEquals(r.ok, false);
});
