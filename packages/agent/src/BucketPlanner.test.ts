import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { BucketPlanner } from './BucketPlanner.ts';
import { NavGraph } from './NavGraph.ts';
import { PlannerKind } from './PlannerKind.ts';
import { SimOutcome } from './SimOutcome.ts';
import { Simulator } from './Simulator.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const planner = new BucketPlanner(jsAdapter);

Deno.test('BucketPlanner is the bucket kind and carries its NavGraph', () => {
  assertEquals(planner.kind, PlannerKind.Bucket);
  const p = planner.plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  assert(p.graph instanceof NavGraph);
});

Deno.test('BucketPlanner: a pickup then the exit, and the recording wins', () => {
  const parsed = Level.parse('#######\n#P.o.E#\n#######');
  const p = planner.plan(parsed, DEFAULT_LEGEND);
  assertEquals(p.goals, ['1,3', '1,5']);
  assert(p.trace[0].why.includes('pickup #1'));
  // Edge ids name the StateKeys they join.
  assert(/^\d+,\d+,-?\d,[LCR]>\d+,\d+,-?\d,[LCR]:/.test(p.trace[0].edgeId), p.trace[0].edgeId);
  const sim = new Simulator(jsAdapter).run(parsed, DEFAULT_LEGEND, p.recording, { maxFrames: 2400 });
  assertEquals(sim.outcome, SimOutcome.Won);
});

Deno.test('BucketPlanner: blocking every edge out of the start leaves the exit unreachable', () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const graph = NavGraph.build(jsAdapter, parsed, DEFAULT_LEGEND);
  const from = '1,1,0,L';
  const blocked = new Set(graph.edgesFrom(from).map((e) => `${from}>${e.to}:${e.kind}`));
  const p = planner.plan(parsed, DEFAULT_LEGEND, { blocked });
  assertEquals(p.trace.length, 0);
  assertEquals(p.unreachable.map((u) => u.kind), ['exit']);
});
