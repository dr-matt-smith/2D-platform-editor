import { assert, assertEquals, assertFalse } from '@std/assert';
import { SearchBudget } from './SearchBudget.ts';

Deno.test('tick reports progress and carries on while there is time', async () => {
  const calls: [number, number][] = [];
  const budget = new SearchBudget(60_000, (elapsed, total) => calls.push([elapsed, total]));
  assert(await budget.tick());
  assertEquals(calls.length, 1);
  assertEquals(calls[0][1], 60_000);
  assert(budget.elapsedMs >= 0);
});

Deno.test('tick returns false once out of time', async () => {
  const budget = new SearchBudget(0);
  assertFalse(await budget.tick());
});

Deno.test('tick returns false when aborted (after reporting progress)', async () => {
  const ac = new AbortController();
  ac.abort();
  let reported = false;
  const budget = new SearchBudget(60_000, () => { reported = true; }, ac.signal);
  assertFalse(await budget.tick());
  assert(reported);
});
