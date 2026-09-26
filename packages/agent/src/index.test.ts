// v29 M5: package smoke. After the move to packages/agent/, the public
// index must export the agent's API, and testLevel() driven by the
// engine's jsAdapter must still solve a trivial level end-to-end.
// (ported from apps/editor/e2e/v29-package-smoke.spec.ts)
import { assert, assertEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import * as agent from './index.ts';

Deno.test('v29 M5: @2d-platform/agent index exports the public API', () => {
  const m: Record<string, unknown> = { ...agent };
  assertEquals(typeof m.testLevel, 'function');
  assertEquals(typeof m.plan, 'function');
  assertEquals(typeof m.simulate, 'function');
  assertEquals(typeof m.buildNavGraph, 'function');
  assertEquals(typeof m.planPerFrame, 'function');
  // Painting paths is editor UI, so the overlay lives in apps/editor now
  // and the agent package no longer exports it.
  assertEquals(typeof m.renderSolutionOverlay, 'undefined');
  assertEquals(typeof m.renderAllSolutionsOverlay, 'undefined');
  assertEquals(typeof m.assertAdapter, 'function');
  assertEquals(m.TILE, 20);
});

Deno.test('v29 M5: testLevel via the package + jsAdapter solves a trivial level', async () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const result = await agent.testLevel(parsed, DEFAULT_LEGEND, null, {
    adapter: jsAdapter,
    maxRuntimeMs: 4000,
  });
  assert(result.ok);
  assert(result.solution);
  assert(result.solution.recording.length > 0);
  assert(Array.isArray(result.solutions));
});
