// v28 M2: expandNode — on-demand edge generation. Given an exact
// state on a parsed level, return every reachable next-state via
// the 46 actions. The edges carry the destination as BOTH a cell
// {r, c} (for A* heuristic + goal-prefix matching) and the live
// endState (for the next leg's seed). No bucketing.

import { test, expect } from '@playwright/test';

test('v28 M2: expandNode from spawn on flat level yields walks + win-edges', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { expandNode, makeContextCache } = await import('/src/agent/perframe.js');
    // Wide enough for walk_left + walk_right to both find a walkable
    // destination cell — P at col 2 so col 1 (.) is open to the left.
    const parsed = parse('######\n#.P.E#\n######');
    const cache = makeContextCache();
    const TILE = 20;
    const state = { x: 2 * TILE, y: 1 * TILE, vx: 0, vy: 0, onGround: true };
    const edges = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
      exitCells: [{ r: 1, c: 4 }],
    });
    return {
      count: edges.length,
      walkKinds: edges.filter((e) => e.kind === 'walk').map((e) => e.dir).sort(),
      anyWin: edges.some((e) => e.isWinEdge),
      walkRight: edges.find((e) => e.kind === 'walk' && e.dir === 'right'),
      shapeOk: edges.every((e) =>
        e.toCell && typeof e.toCell.r === 'number' &&
        typeof e.toCell.c === 'number' && e.toState &&
        typeof e.toState.x === 'number' && typeof e.toState.y === 'number'),
    };
  });
  expect(out.count).toBeGreaterThan(0);
  expect(out.walkKinds).toContain('left');
  expect(out.walkKinds).toContain('right');
  // The exit is 2 cells right of spawn; jumps + walks may reach it.
  expect(out.anyWin).toBe(true);
  expect(out.shapeOk).toBe(true);
  expect(out.walkRight?.cost).toBe(5);
});

test('v28 M2: expandNode results are deterministic across calls', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { expandNode, makeContextCache } = await import('/src/agent/perframe.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const cache = makeContextCache();
    const state = { x: 20, y: 20, vx: 0, vy: 0, onGround: true };
    const e1 = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
      exitCells: [{ r: 1, c: 3 }],
    });
    const e2 = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
      exitCells: [{ r: 1, c: 3 }],
    });
    // Compare a few summary signals — endState scalars should be
    // bit-equal across calls (pure physics integration).
    return {
      sameLen: e1.length === e2.length,
      sameFirstEnd:
        e1[0].endState.x === e2[0].endState.x &&
        e1[0].endState.y === e2[0].endState.y,
    };
  });
  expect(out.sameLen).toBe(true);
  expect(out.sameFirstEnd).toBe(true);
});

test('v28 M2: edge.toState is the exact endState (no bucketing)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { expandNode, makeContextCache } = await import('/src/agent/perframe.js');
    // Wider level so the player has room to accelerate.
    const parsed = parse('##########\n#P......E#\n##########');
    const cache = makeContextCache();
    const TILE = 20;
    const state = { x: TILE, y: TILE, vx: 0, vy: 0, onGround: true };
    const edges = expandNode(cache, parsed, DEFAULT_LEGEND, null, state, {
      exitCells: [{ r: 1, c: 8 }],
    });
    // Find a walk_right edge; its endState.x should be > start.x and
    // the cell should match toCell.
    const walkR = edges.find((e) => e.kind === 'walk' && e.dir === 'right');
    const endCellC = Math.floor((walkR.endState.x + TILE / 2) / TILE);
    return {
      sameRef: walkR.toState === walkR.endState,
      endStateMatchesToCell: endCellC === walkR.toCell.c,
      xMoved: walkR.endState.x > state.x,
    };
  });
  expect(out.sameRef).toBe(true);
  expect(out.endStateMatchesToCell).toBe(true);
  expect(out.xMoved).toBe(true);
});

test('v28 M2: makeContextCache caches across multiple expand calls', async ({ page }) => {
  // The simContext is expensive to build (PlaytestScene construction).
  // Two expand calls with the same parsed object MUST reuse the same
  // ctx — otherwise per-leg perf would tank.
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { expandNode, makeContextCache } = await import('/src/agent/perframe.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const cache = makeContextCache();
    expandNode(cache, parsed, DEFAULT_LEGEND, null,
      { x: 20, y: 20, vx: 0, vy: 0, onGround: true });
    expandNode(cache, parsed, DEFAULT_LEGEND, null,
      { x: 40, y: 20, vx: 0, vy: 0, onGround: true });
    return { entries: cache.size, hasParsed: cache.has(parsed) };
  });
  expect(out.entries).toBe(1);
  expect(out.hasParsed).toBe(true);
});
