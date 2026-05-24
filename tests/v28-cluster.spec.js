// v28 M1: cluster-key helpers. The per-frame A*'s "visited / cost-
// known" identity is the cluster key — nearby exactStates collapse
// to the same key so the search doesn't explode while staying
// accurate enough to never let the chain drift across an
// equivalence-class boundary (see design §3.1).

import { test, expect } from '@playwright/test';

test('v28 M1: identical states cluster identically', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { clusterKey } = await import('/src/agent/perframe.js');
    const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    const b = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    return { ka: clusterKey(a), kb: clusterKey(b) };
  });
  expect(out.ka).toBe(out.kb);
  // Key is a stable string with 5 comma-separated parts.
  expect(out.ka.split(',')).toHaveLength(5);
});

test('v28 M1: sub-tolerance Δ on any axis clusters identically', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { clusterKey, nearby } = await import('/src/agent/perframe.js');
    const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    const xJitter = { ...base, x: 100.24 };   // < 0.5 / 2 of x tol
    const yJitter = { ...base, y: 50.24 };
    const vxJitter = { ...base, vx: 2.4 };    // < 5 / 2 of vx tol
    const vyJitter = { ...base, vy: 2.4 };
    return {
      xMatch: nearby(base, xJitter),
      yMatch: nearby(base, yJitter),
      vxMatch: nearby(base, vxJitter),
      vyMatch: nearby(base, vyJitter),
      // Same key string for the all-jitter version.
      keyBase: clusterKey(base),
      keyAll: clusterKey({ ...base, x: 100.24, y: 50.24, vx: 2.4, vy: 2.4 }),
    };
  });
  expect(out.xMatch).toBe(true);
  expect(out.yMatch).toBe(true);
  expect(out.vxMatch).toBe(true);
  expect(out.vyMatch).toBe(true);
  expect(out.keyAll).toBe(out.keyBase);
});

test('v28 M1: above-tolerance Δ clusters distinctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { nearby } = await import('/src/agent/perframe.js');
    const base = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    return {
      xFar: nearby(base, { ...base, x: 101 }),   // 1 px > 0.5 tol
      yFar: nearby(base, { ...base, y: 51 }),
      vxFar: nearby(base, { ...base, vx: 8 }),   // 8 > 5 vx tol
      vyFar: nearby(base, { ...base, vy: 8 }),
    };
  });
  expect(out.xFar).toBe(false);
  expect(out.yFar).toBe(false);
  expect(out.vxFar).toBe(false);
  expect(out.vyFar).toBe(false);
});

test('v28 M1: onGround flip breaks clustering (no tolerance on the bool)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { nearby } = await import('/src/agent/perframe.js');
    const grounded = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    const airborne = { x: 100, y: 50, vx: 0, vy: 0, onGround: false };
    return { same: nearby(grounded, airborne) };
  });
  expect(out.same).toBe(false);
});

test('v28 M1: custom tolerance changes the equivalence class', async ({ page }) => {
  // Rounding boundary is at half-tol (100/0.5 = 200; 100.25/0.5 = 200.5
  // rounds to 201). A diff of 0.2 px keeps the same cluster under
  // default tol (0.5) but flips under a tighter tol (0.1, half-tol
  // = 0.05). A 20-px diff joins under a 50-px tol.
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { nearby } = await import('/src/agent/perframe.js');
    const a = { x: 100, y: 50, vx: 0, vy: 0, onGround: true };
    const b = { x: 100.2, y: 50, vx: 0, vy: 0, onGround: true };
    return {
      defaultClusters: nearby(a, b),                      // 0.2 < 0.25 half-tol → same
      tightSplits: nearby(a, b, { x: 0.1, y: 0.5, vx: 5, vy: 5 }), // 0.2 > 0.05 half-tol → diff
      looseJoins: nearby(
        { ...a, x: 90 },
        { ...a, x: 110 },
        { x: 50, y: 50, vx: 5, vy: 5 },
      ),  // 20 px diff but 50-px tol → same
    };
  });
  expect(out.defaultClusters).toBe(true);
  expect(out.tightSplits).toBe(false);
  expect(out.looseJoins).toBe(true);
});
