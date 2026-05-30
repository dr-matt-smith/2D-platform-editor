// v29 M4: workspace scaffolding. The root package.json declares the
// packages/* workspace; packages/agent/package.json is the carved-out
// agent's manifest. The agent's source files don't MOVE until M5 —
// this milestone just asserts the metadata is well-formed so the move
// is mechanical.

import { test, expect } from '@playwright/test';

test('v29 M4: root package.json declares the packages/* workspace', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const pkg = await page.evaluate(async () => {
    const r = await fetch('/package.json');
    return r.ok ? await r.json() : null;
  });
  expect(pkg).toBeTruthy();
  expect(Array.isArray(pkg.workspaces)).toBe(true);
  expect(pkg.workspaces).toContain('packages/*');
});

test('v29 M4: packages/agent/package.json is well-formed', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const pkg = await page.evaluate(async () => {
    const r = await fetch('/packages/agent/package.json');
    return r.ok ? await r.json() : null;
  });
  expect(pkg).toBeTruthy();
  expect(pkg.name).toBe('@2d-platform/agent');
  expect(pkg.private).toBe(true);
  expect(pkg.type).toBe('module');
  expect(pkg.main).toBe('src/index.js');
});

test('v29 M4: agent local constants match the engine TILE', async ({ page }) => {
  // The agent now owns src/agent/constants.js (TILE=20) instead of
  // importing src/play/constants.js. Assert it equals the adapter's
  // engine TILE — the same value the assertAdapter() contract checks.
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { TILE } = await import('/packages/agent/src/constants.js');
    const { jsAdapter } = await import('/src/agent-adapter.js');
    return { agentTile: TILE, adapterTile: jsAdapter.TILE };
  });
  expect(out.agentTile).toBe(20);
  expect(out.adapterTile).toBe(20);
});
