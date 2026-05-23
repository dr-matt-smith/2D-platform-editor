// v26 M4: nav-graph node identity is now (cell, vxBucket). Each
// walkable cell expands to 3 nodes — one per vxBucket ∈ {-1, 0, +1}.
// A* operates on these richer keys; goal-matching accepts any
// vxBucket variant of the target cell.

import { test, expect } from '@playwright/test';

test('v26 M4: graph node count = walkable-cells × 3 (vxBucket variants)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const data = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { buildNavGraph } = await import('/src/agent/grid.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const g = buildNavGraph(parsed, DEFAULT_LEGEND);
    return { nodeCount: g.nodes.size, edgeKeys: [...g.edges.keys()] };
  });
  // 3 walkable cells × 3 vxBuckets = 9 nodes.
  expect(data.nodeCount).toBe(9);
  // Every node key has the three-part stateKey shape.
  for (const k of data.edgeKeys) {
    expect(k.split(',')).toHaveLength(3);
  }
});

test('v26 M4: stateKey + vxBucketOf + parseStateKey helpers', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const r = await page.evaluate(async () => {
    const { stateKey, vxBucketOf, parseStateKey, VX_BUCKETS } = await import('/src/agent/grid.js');
    return {
      keyMid: stateKey(5, 7, 0),
      keyLeft: stateKey(5, 7, -1),
      keyRight: stateKey(5, 7, +1),
      bucketStill: vxBucketOf(0),
      bucketLeft: vxBucketOf(-240),
      bucketRight: vxBucketOf(+240),
      bucketSmall: vxBucketOf(15), // < 30 threshold
      parsed: parseStateKey('5,7,1'),
      buckets: VX_BUCKETS,
    };
  });
  expect(r.keyMid).toBe('5,7,0');
  expect(r.keyLeft).toBe('5,7,-1');
  expect(r.keyRight).toBe('5,7,1');
  expect(r.bucketStill).toBe(0);
  expect(r.bucketLeft).toBe(-1);
  expect(r.bucketRight).toBe(1);
  expect(r.bucketSmall).toBe(0); // |vx| < 30 → still
  expect(r.parsed).toEqual({ r: 5, c: 7, vxBucket: 1 });
  expect(r.buckets).toEqual([-1, 0, 1]);
});

test('v26 M4: A* finds a path through state-space nodes', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const result = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { aStar } = await import('/src/agent/planner.js');
    const { buildNavGraph } = await import('/src/agent/grid.js');
    // A wider level so the path has multiple edges.
    const parsed = parse('############\n#P........E#\n############');
    const g = buildNavGraph(parsed, DEFAULT_LEGEND);
    // v26: A* `from` is stateKey, `to` is cellKey. Match any
    // vxBucket variant of the exit cell.
    const path = aStar(g, '1,1,0', '1,10');
    return {
      hasPath: !!path && path.length > 0,
      edgeCount: path?.length ?? 0,
    };
  });
  expect(result.hasPath).toBe(true);
});

test('v26 M4: existing v25 levels still solve under bucket-aware A*', async ({ page }) => {
  // The acceptance gate: agent-suite levels v22-v25 already solved
  // must continue solving. above_ground was the v24 M5 regression
  // risk; tutorial.txt was v24's level redesign.
  await page.goto('/');
  await page.waitForSelector('#preview');
  for (const file of ['above_ground.txt', 'tutorial.txt']) {
    const text = await page.evaluate(async (f) => {
      const r = await fetch('data/levels/' + f);
      return r.ok ? await r.text() : null;
    }, file);
    expect(text).toBeTruthy();
    await page.evaluate((t) => {
      document.querySelector('#src').value = t;
      document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    await page.waitForTimeout(300);
    await page.locator('#testBtn').click();
    await page.waitForSelector('.badge.ok', { timeout: 8000 });
    // Close the dialog for the next level.
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
