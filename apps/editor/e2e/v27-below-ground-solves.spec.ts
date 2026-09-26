// v27 M5 acceptance gate. The v27 design's headline goal was
// "below_ground.txt solves end-to-end" — that promise wasn't kept.
// The 9-bucket state-space data model (M4) is in place: each cell
// expands to 9 (vxBucket × xOffsetBucket) nodes. But enabling 'C' /
// 'R' xOffsetBucket sources as A* origins re-introduces a chain
// fragility v26 already documented at a coarser granularity:
// reSim's actual landing bucket may not match the planned edge.to's
// bucket, the recorded action sequence was built for a specific
// sub-cell start, and per-leg replanning A* picks alternate edges
// that have the same fragility — the chain doesn't converge.
//
// What M5 DID deliver:
//   - All v21-v26 levels continue to solve (regression gate held)
//   - below_ground.txt at v26 baseline (score 8 of 16; same as v26)
//   - 9-node identity + xOffsetBucket helpers + 4-part stateKey
//     (M4 carry-over)
//   - Per-leg replan loop in planner.ts (no-op for L-only chains;
//     ready to be re-enabled when v28's per-frame planner ships)
//
// The fundamental architectural step — a per-frame trajectory
// planner that doesn't bucket at all — moves to v28+. See v27
// design §10 risks, §9 deferred.

// The below_ground plan() + simulate() progress check now lives in
// packages/agent/src/regression.test.ts; only the Test-button flow remains here.

import { test, expect, type Page } from '@playwright/test';

async function injectLevel(page: Page, text: string) {
  return page.evaluate((t: string) => {
    document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
    document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v27 M5: regression gate — every shipped agent-suite level solves', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  for (const file of ['tutorial.txt', 'above_ground.txt', 'simple.txt']) {
    const text = await page.evaluate(async (f) => {
      const r = await fetch('/data/levels/' + f);
      return r.ok ? await r.text() : null;
    }, file);
    expect(text, `level ${file} not fetched`).toBeTruthy();
    await injectLevel(page, text!);
    await page.waitForTimeout(300);
    await page.locator('#testBtn').click();
    await page.waitForSelector('.badge.ok', { timeout: 8000 });
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
