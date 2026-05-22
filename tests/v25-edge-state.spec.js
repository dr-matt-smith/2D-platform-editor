// v25 M1: simulateActionInContext returns `endState: {x, y, vx, vy,
// onGround}` alongside the existing endCell/endPos/endVel. The nav
// graph stores it on each edge. M2 (next milestone) consumes it
// for sub-pixel-aware re-simulation in the planner; M1 just exposes
// the data.

import { test, expect } from '@playwright/test';

test('v25 M1: simAction returns endState matching endPos/endVel', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const data = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { makeSimContext, simulateActionInContext } = await import('/src/agent/simAction.js');
    const parsed = parse('# size: 6x4\n######\n#P..E#\n######');
    const ctx = makeSimContext(parsed, DEFAULT_LEGEND, null);
    const result = simulateActionInContext(
      ctx,
      { x: 20, y: 20, vx: 0, vy: 0, onGround: true },
      { kind: 'walk', params: { dir: 'right', cells: 1 } },
    );
    return {
      hasEndState: !!result.endState,
      keys: Object.keys(result.endState || {}).sort(),
      endStateXY: { x: result.endState.x, y: result.endState.y },
      endPos: result.endPos,
      endVel: result.endVel,
    };
  });
  expect(data.hasEndState).toBe(true);
  expect(data.keys).toEqual(['onGround', 'vx', 'vy', 'x', 'y']);
  // endState.x/y == endPos.x/y (same data, new field — no drift).
  expect(data.endStateXY.x).toBeCloseTo(data.endPos.x, 5);
  expect(data.endStateXY.y).toBeCloseTo(data.endPos.y, 5);
});

test('v25 M1: buildNavGraph edges carry endState', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const inspect = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { buildNavGraph } = await import('/src/agent/grid.js');
    const parsed = parse('# size: 6x4\n######\n#P..E#\n######');
    const g = buildNavGraph(parsed, DEFAULT_LEGEND);
    const startK = g.start ? `${g.start.r},${g.start.c}` : null;
    const edges = startK ? (g.edges.get(startK) || []) : [];
    // Sample at least one edge; assert endState shape.
    if (!edges.length) return { ok: false, reason: 'no edges' };
    const e = edges[0];
    return {
      ok: true,
      hasEndState: !!e.endState,
      keys: Object.keys(e.endState || {}).sort(),
      endStateMatchesEndPos:
        Math.abs(e.endState.x - e.endPos.x) < 0.01 &&
        Math.abs(e.endState.y - e.endPos.y) < 0.01,
    };
  });
  expect(inspect.ok).toBe(true);
  expect(inspect.hasEndState).toBe(true);
  expect(inspect.keys).toEqual(['onGround', 'vx', 'vy', 'x', 'y']);
  expect(inspect.endStateMatchesEndPos).toBe(true);
});
