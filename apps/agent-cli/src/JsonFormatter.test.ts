import { assertEquals } from '@std/assert';
import { JsonFormatter } from './JsonFormatter.ts';
import { SweepSummary } from './SweepSummary.ts';
import { SOLVED } from './testReports.ts';

const json = new JsonFormatter();

Deno.test('JSON output round-trips the report, recordings included', () => {
  assertEquals(JSON.parse(json.report(SOLVED)), SOLVED);
  const totals = { total: 1, solved: 1, unsolved: 0, invalid: 0, elapsedMs: 59, failed: [] };
  const summary = new SweepSummary(totals);
  assertEquals(JSON.parse(json.sweepSummary(summary, [SOLVED])), { summary: totals, levels: [SOLVED] });
});

Deno.test('a JSON sweep prints nothing until the summary', () => {
  assertEquals(json.sweepHeader(), null);
  assertEquals(json.sweepRow(), null);
});

Deno.test('JSON is indented by two spaces', () => {
  assertEquals(json.report(SOLVED), JSON.stringify(SOLVED, null, 2));
});
