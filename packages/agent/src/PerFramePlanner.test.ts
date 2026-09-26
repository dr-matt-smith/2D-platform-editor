import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { GoalKind } from './GoalKind.ts';
import { PerFrameExpander } from './PerFrameExpander.ts';
import { PerFramePlanner } from './PerFramePlanner.ts';
import { PlannerKind } from './PlannerKind.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

Deno.test('PerFramePlanner is the per-frame kind', () => {
  assertEquals(new PerFramePlanner(jsAdapter).kind, PlannerKind.PerFrame);
});

Deno.test('findPath: exact-state A* to a goal cell; empty when already there', () => {
  const parsed = Level.parse('##########\n#P......E#\n##########');
  const planner = new PerFramePlanner(jsAdapter);
  const expander = new PerFrameExpander(jsAdapter, parsed, DEFAULT_LEGEND, null, { exitCells: [{ r: 1, c: 8 }] });
  const start = { x: 20, y: 20, vx: 0, vy: 0, onGround: true };
  assertEquals(planner.findPath(expander, start, '1,1'), []);
  const path = planner.findPath(expander, start, '1,8');
  assert(path && path.length > 0);
  const last = path[path.length - 1].edge;
  assertEquals(last.toCell, { r: 1, c: 8 });
  // Each step starts where the previous one ended, exactly.
  for (let i = 1; i < path.length; i++) {
    assertEquals(path[i].fromState, path[i - 1].edge.toState);
  }
});

Deno.test('the node cap bounds the search: a cap of 1 expands only the start', () => {
  const parsed = Level.parse('##########\n#P......E#\n##########');
  const planner = new PerFramePlanner(jsAdapter, { nodeCap: 1 });
  const p = planner.plan(parsed, DEFAULT_LEGEND);
  assertEquals(p.trace.length, 0);
  assertEquals(p.unreachable, [{ r: 1, c: 8, kind: GoalKind.Exit }]);
});

Deno.test('no spawn or no exit → an empty plan with no layout', () => {
  const planner = new PerFramePlanner(jsAdapter);
  assertEquals(planner.plan(Level.parse('#####\n#P..#\n#####'), DEFAULT_LEGEND).graph, null);
  assertEquals(planner.plan(Level.parse('#####\n#..E#\n#####'), DEFAULT_LEGEND).graph, null);
});

Deno.test('blocked steps are never taken, so blocking a step gives a different route', () => {
  const planner = new PerFramePlanner(jsAdapter);
  const level = Level.parse(Deno.readTextFileSync('content/data/levels/tutorial.txt'));
  const first = planner.plan(level, DEFAULT_LEGEND);
  const blocked = new Set([first.stepsToBlock(new Set())[0]]);
  const alt = planner.plan(level, DEFAULT_LEGEND, { blocked });
  assert(!alt.isEmpty);
  assert(alt.trace.every((step) => !blocked.has(step.edgeId)));
  assert(alt.routeKey() !== first.routeKey());
});

Deno.test('step ids name the start cell, target cell and kind: "r,c>r,c:kind"', () => {
  const p = new PerFramePlanner(jsAdapter).plan(Level.parse('#####\n#P.E#\n#####'), DEFAULT_LEGEND);
  const step = p.trace[0];
  // From the spawn cell (1,1) to the exit cell (1,3), then the move's kind.
  assertEquals(step.edgeId, `1,1>1,3:${step.kind}`);
});
