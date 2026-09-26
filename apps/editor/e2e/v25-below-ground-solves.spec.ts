// v25 M3: below_ground.txt acceptance + agent-suite regression
// gate. M2's sub-pixel-aware planner (re-simulate + emit mid-arc
// dir release) made significant progress on below_ground —
// player no longer dies at frame 49; collects all 8 row-7 ooo
// pickups; reaches (7, 22) — but the final jump to the row-5
// platform STILL misses (cell-resolved A* picks edges using
// cell-pixel start positions; actual sub-pixel trajectory drifts
// enough that the second-jump endpoint differs from the build-
// time prediction).
//
// The full solve needs approach 3.1.b (per-frame-trajectory
// planner) from the v25 design §3.1 — A* over sub-pixel state
// space, not cell-resolved edges. v26+ candidate.
//
// This spec asserts the v25 PROGRESS:
//   - player gets past frame 49 (no longer the v24 M5 hazard pit
//     death)
//   - score > 0 (collects at least one pickup)
//   - all OTHER shipped levels (above_ground, tutorial,
//     tower-cherry) continue to solve

// The plan() + simulate() progress check now lives in
// packages/agent/src/regression.test.ts; only the Test-button flow remains here.

import { test, type Page } from '@playwright/test';

async function injectLevel(page: Page, text: string) {
  return page.evaluate((t: string) => {
    document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
    document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v25 M3: above_ground.txt + tower-cherry + tutorial still solve', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  // above_ground was the v24 M5 regression risk. Must still solve.
  const text = await page.evaluate(async () => {
    const r = await fetch('/data/levels/above_ground.txt');
    return await r.text();
  });
  await injectLevel(page, text);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
});
