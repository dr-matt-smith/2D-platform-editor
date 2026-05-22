// v25 M4: precision_landing edge rule. For each precision target
// (pickup cells + exit cells), if any action's trajectory passes
// within ±2 px of the target's CENTRE while descending, emit an
// additional edge to that target's cell. Lets the agent reach
// 1-tile pickups that the cell-resolved edge model misses.

import { test, expect } from '@playwright/test';

test('v25 M4: simAction returns trajectory when collectTrajectory: true', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const probe = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { makeSimContext, simulateActionInContext } = await import('/src/agent/simAction.js');
    const parsed = parse('# size: 10x4\n##########\n#P......E#\n##########');
    const ctx = makeSimContext(parsed, DEFAULT_LEGEND, null);
    // Without flag — no trajectory.
    const a = simulateActionInContext(
      ctx,
      { x: 20, y: 20, vx: 0, vy: 0, onGround: true },
      { kind: 'jump', params: { dir: 'right', holdFrames: 20 } },
    );
    // With flag — trajectory populated.
    const b = simulateActionInContext(
      ctx,
      { x: 20, y: 20, vx: 0, vy: 0, onGround: true },
      { kind: 'jump', params: { dir: 'right', holdFrames: 20 } },
      { collectTrajectory: true },
    );
    return {
      withoutFlag: a.trajectory,
      trajLen: Array.isArray(b.trajectory) ? b.trajectory.length : 0,
      sampleFrame: b.trajectory?.[0],
    };
  });
  expect(probe.withoutFlag).toBeNull();
  expect(probe.trajLen).toBeGreaterThan(0);
  expect(probe.sampleFrame).toHaveProperty('x');
  expect(probe.sampleFrame).toHaveProperty('y');
});

test('v25 M4: grid emits precision edges that pass ±2 px target centres', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Construct a level with a 1-tile pickup on the side of a
  // pillar so that the cell-resolved edge model wouldn't reach
  // it directly, but the precision rule should.
  const data = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { buildNavGraph } = await import('/src/agent/grid.js');
    // Level: P on row 5 col 1. Pickup `o` at row 3 col 7 with
    // walls around forcing precision landing.
    const parsed = parse([
      '# size: 12x7',
      '############',
      '#..........#',
      '#..........#',
      '#......o...#',
      '#..........#',
      '#.P......E.#',
      '############',
    ].join('\n'));
    const g = buildNavGraph(parsed, DEFAULT_LEGEND);
    // Count edges flagged precision (the rule fired).
    let totalPrecisionEdges = 0;
    for (const edges of g.edges.values()) {
      for (const e of edges) {
        if (e.precision) totalPrecisionEdges++;
      }
    }
    return {
      hasPrecisionEdges: totalPrecisionEdges > 0,
      pickupCount: g.pickupCells.length,
    };
  });
  expect(data.pickupCount).toBe(1);
  // The grid build emits precision edges when trajectories pass
  // ±2 px of target centres. For any normal jump arc that crosses
  // near a target, expect at least ONE precision edge.
  expect(data.hasPrecisionEdges).toBe(true);
});

test('v25 M4: existing levels still solve (precision edges are additive)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // tutorial.txt — solvable since v24 M4; must still solve under
  // M4's added precision edges (they only add to the graph, never
  // remove existing edges).
  const text = await page.evaluate(async () => {
    const r = await fetch('data/levels/tutorial.txt');
    return await r.text();
  });
  await page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 6000 });
});
