import { assert, assertFalse, assertEquals, assertInstanceOf } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { BucketPlanner } from './BucketPlanner.ts';
import { PerFramePlanner } from './PerFramePlanner.ts';
import { PlannerFactory } from './PlannerFactory.ts';
import { PlannerKind } from './PlannerKind.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

Deno.test('PlannerFactory.create makes the planner for each kind', () => {
  assertInstanceOf(PlannerFactory.create(jsAdapter, PlannerKind.PerFrame), PerFramePlanner);
  assertInstanceOf(PlannerFactory.create(jsAdapter, PlannerKind.Bucket), BucketPlanner);
  assertEquals(PlannerFactory.create(jsAdapter, PlannerKind.Bucket).kind, PlannerKind.Bucket);
});

Deno.test('default strategy is per-frame', () => {
  assertEquals(PlannerFactory.DEFAULT_KIND, PlannerKind.PerFrame);
  const p = PlannerFactory.create(jsAdapter).plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  // Per-frame step ids are "r,c>r,c:kind" (bucket ids also carry vx and x-offset buckets).
  const firstEdgeId = p.trace[0]?.edgeId ?? null;
  assert(firstEdgeId);
  assert(/^\d+,\d+>\d+,\d+:[a-z_]+$/.test(firstEdgeId), firstEdgeId);
});

Deno.test('the bucket strategy is still callable for diagnostics', () => {
  const planner = PlannerFactory.create(jsAdapter, PlannerKind.Bucket);
  const p = planner.plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  const firstEdgeId = p.trace[0]?.edgeId ?? null;
  assert(firstEdgeId);
  // Bucket edge ids look like "r,c,vx,xo>r,c,vx,xo:kind".
  assertFalse(firstEdgeId.startsWith('perframe'));
});
