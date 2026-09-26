// v29 M4: workspace scaffolding. The root deno.json declares the
// packages/agent workspace member; packages/agent/deno.json is the
// carved-out agent's manifest. The agent's source files don't MOVE until M5 —
// this milestone just asserts the metadata is well-formed so the move
// is mechanical.

import { test, expect } from '@playwright/test';

test('v29 M4: root deno.json declares the packages/agent workspace member', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const cfg = await page.evaluate(async () => {
    const r = await fetch('/deno.json');
    return r.ok ? await r.json() : null;
  });
  expect(cfg).toBeTruthy();
  expect(Array.isArray(cfg.workspace)).toBe(true);
  expect(cfg.workspace).toContain('./packages/agent');
});

test('v29 M4: packages/agent/deno.json is well-formed', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const cfg = await page.evaluate(async () => {
    const r = await fetch('/packages/agent/deno.json');
    return r.ok ? await r.json() : null;
  });
  expect(cfg).toBeTruthy();
  expect(cfg.name).toBe('@2d-platform/agent');
  expect(cfg.exports).toBe('./src/index.ts');
});

test('v29 M4: agent local constants match the engine TILE', async ({ page }) => {
  // The agent now owns src/agent/constants.ts (TILE=20) instead of
  // importing src/play/constants.ts. Assert it equals the adapter's
  // engine TILE — the same value the assertAdapter() contract checks.
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { TILE } = await import('/packages/agent/src/constants.ts');
    const { jsAdapter } = await import('/src/agent-adapter.ts');
    return { agentTile: TILE, adapterTile: jsAdapter.TILE };
  });
  expect(out.agentTile).toBe(20);
  expect(out.adapterTile).toBe(20);
});
