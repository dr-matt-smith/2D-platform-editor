// v29 M5: package smoke. After the move to packages/agent/, the
// public index must export the agent's API, and testLevel() driven by
// the editor's jsAdapter must still solve a trivial level end-to-end.
// (main.js imports the bare specifier '@2d-platform/agent' via the
// Vite alias; this spec exercises the same index via its served path,
// since a browser dynamic import can't resolve the bare specifier at
// runtime.)

import { test, expect } from '@playwright/test';

test('v29 M5: @2d-platform/agent index exports the public API', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const m = await import('/packages/agent/src/index.js');
    return {
      testLevel: typeof m.testLevel,
      plan: typeof m.plan,
      simulate: typeof m.simulate,
      buildNavGraph: typeof m.buildNavGraph,
      planPerFrame: typeof m.planPerFrame,
      renderSolutionOverlay: typeof m.renderSolutionOverlay,
      renderAllSolutionsOverlay: typeof m.renderAllSolutionsOverlay,
      assertAdapter: typeof m.assertAdapter,
      TILE: m.TILE,
    };
  });
  expect(out.testLevel).toBe('function');
  expect(out.plan).toBe('function');
  expect(out.simulate).toBe('function');
  expect(out.buildNavGraph).toBe('function');
  expect(out.planPerFrame).toBe('function');
  expect(out.renderSolutionOverlay).toBe('function');
  expect(out.renderAllSolutionsOverlay).toBe('function');
  expect(out.assertAdapter).toBe('function');
  expect(out.TILE).toBe(20);
});

test('v29 M5: testLevel via the package + jsAdapter solves a trivial level', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { testLevel } = await import('/packages/agent/src/index.js');
    const { jsAdapter } = await import('/src/agent-adapter.js');
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const result = await testLevel(parsed, DEFAULT_LEGEND, null, {
      adapter: jsAdapter,
      maxRuntimeMs: 4000,
    });
    return {
      ok: result.ok,
      hasSolution: !!result.solution,
      recordingLen: result.solution?.recording?.length ?? 0,
      solutionsIsArray: Array.isArray(result.solutions),
    };
  });
  expect(out.ok).toBe(true);
  expect(out.hasSolution).toBe(true);
  expect(out.recordingLen).toBeGreaterThan(0);
  expect(out.solutionsIsArray).toBe(true);
});
