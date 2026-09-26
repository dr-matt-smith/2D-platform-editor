// Package smoke: the public index exports the agent's API, and a
// LevelTester driven by the engine's jsAdapter solves a trivial level.
import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import * as agent from './index.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

Deno.test('@2d-platform/agent index exports the public API', () => {
  const m: Record<string, unknown> = { ...agent };
  for (const name of [
    'LevelTester', 'Solution', 'Planner', 'PlannerFactory', 'PerFramePlanner', 'BucketPlanner',
    'Plan', 'PlanBuilder', 'PerFrameExpander', 'NavGraph', 'PickupTour', 'LevelGrid', 'StateKey',
    'Action', 'MoveAction', 'ActionCatalog', 'Simulator', 'ActionSimulator', 'AdapterGuard',
  ]) {
    assertEquals(typeof m[name], 'function', name);
  }
  assertEquals(agent.PlannerKind.PerFrame, 'perframe');
  assertEquals(agent.ActionKind.DropRelease, 'drop_release');
  // Painting paths is editor UI, so the overlay lives in apps/editor.
  assertEquals(typeof m.renderSolutionOverlay, 'undefined');
  assertEquals(typeof m.renderAllSolutionsOverlay, 'undefined');
  assertEquals(m.TILE, 20);
});

Deno.test('LevelTester via the package + jsAdapter solves a trivial level', async () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const result = await agent.LevelTester.create(jsAdapter).test(parsed, DEFAULT_LEGEND, null, {
    maxRuntimeMs: 4000,
  });
  assert(result.ok);
  assert(result.solution);
  assert(result.solution.recording.length > 0);
  assert(Array.isArray(result.solutions));
});
