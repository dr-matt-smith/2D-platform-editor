// v27 M4: nav-graph node identity expands to (cell, vxBucket,
// xOffsetBucket). Each grounded cell now produces 3 × 3 = 9 nodes —
// vxBucket ∈ {-1, 0, +1} × xOffsetBucket ∈ {'L', 'C', 'R'}. A*
// goal-matching by cell prefix still accepts any of the 9 variants.
// This spec covers the new helpers + the 9× node-count + the
// expected stateKey shape.

import { test, expect } from '@playwright/test';

test('v27 M4: graph node count = walkable-cells × 9 (vx × xOffset variants)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const data = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { buildNavGraph } = await import('/src/agent/grid.js');
    // Same level as the v26 spec: 3 walkable middle cells.
    const parsed = parse('#####\n#P.E#\n#####');
    const g = buildNavGraph(parsed, DEFAULT_LEGEND);
    return { nodeCount: g.nodes.size, edgeKeys: [...g.edges.keys()] };
  });
  // 3 walkable cells × 9 (3 vxBuckets × 3 xOffsetBuckets) = 27 nodes.
  expect(data.nodeCount).toBe(27);
  // Every node key has the four-part stateKey shape.
  for (const k of data.edgeKeys) {
    expect(k.split(',')).toHaveLength(4);
  }
});

test('v27 M4: xOffsetBucketOf splits a cell into L/C/R thirds', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const r = await page.evaluate(async () => {
    const { xOffsetBucketOf, X_OFFSET_BUCKETS } = await import('/src/agent/grid.js');
    const TILE = 20;
    return {
      leftEdge: xOffsetBucketOf(0),
      leftMid: xOffsetBucketOf(TILE / 6),
      thirdBoundary: xOffsetBucketOf(TILE / 3 - 0.01),
      centreStart: xOffsetBucketOf(TILE / 3),
      centre: xOffsetBucketOf(TILE / 2),
      rightBoundary: xOffsetBucketOf((2 * TILE) / 3 - 0.01),
      rightStart: xOffsetBucketOf((2 * TILE) / 3),
      rightEdge: xOffsetBucketOf(TILE - 0.01),
      // Wrap into next cell — sub-pixel should reset.
      nextCellLeft: xOffsetBucketOf(TILE),
      nextCellOffset: xOffsetBucketOf(TILE + 1),
      buckets: X_OFFSET_BUCKETS,
    };
  });
  expect(r.leftEdge).toBe('L');
  expect(r.leftMid).toBe('L');
  expect(r.thirdBoundary).toBe('L');
  expect(r.centreStart).toBe('C');
  expect(r.centre).toBe('C');
  expect(r.rightBoundary).toBe('C');
  expect(r.rightStart).toBe('R');
  expect(r.rightEdge).toBe('R');
  expect(r.nextCellLeft).toBe('L');
  expect(r.nextCellOffset).toBe('L');
  expect(r.buckets).toEqual(['L', 'C', 'R']);
});

test('v27 M4: stateKey is 4-part; parseStateKey round-trips', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const r = await page.evaluate(async () => {
    const { stateKey, parseStateKey } = await import('/src/agent/grid.js');
    return {
      defaultKey: stateKey(5, 7),
      explicit: stateKey(5, 7, -1, 'R'),
      parsed: parseStateKey('5,7,1,C'),
      parts: stateKey(5, 7, 0, 'L').split(','),
    };
  });
  expect(r.defaultKey).toBe('5,7,0,L');
  expect(r.explicit).toBe('5,7,-1,R');
  expect(r.parsed).toEqual({ r: 5, c: 7, vxBucket: 1, xOffsetBucket: 'C' });
  expect(r.parts).toHaveLength(4);
});

test('v27 M4: bucketCentreX picks bucket representatives within their thirds', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const r = await page.evaluate(async () => {
    const { bucketCentreX, xOffsetBucketOf } = await import('/src/agent/grid.js');
    const c = 5;
    const lx = bucketCentreX(c, 'L');
    const cx = bucketCentreX(c, 'C');
    const rx = bucketCentreX(c, 'R');
    return {
      lx, cx, rx,
      lBucket: xOffsetBucketOf(lx),
      cBucket: xOffsetBucketOf(cx),
      rBucket: xOffsetBucketOf(rx),
    };
  });
  // Each representative must land in its own bucket — a round-trip check.
  expect(r.lBucket).toBe('L');
  expect(r.cBucket).toBe('C');
  expect(r.rBucket).toBe('R');
  // L bucket maps to the cell-left edge (sub-pixel 0) so v26
  // bucket-0 behaviour stays byte-identical.
  expect(r.lx).toBe(5 * 20);
});

test('v27 M4: existing v25/v26 levels still solve under 9× state-space A*', async ({ page }) => {
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
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
