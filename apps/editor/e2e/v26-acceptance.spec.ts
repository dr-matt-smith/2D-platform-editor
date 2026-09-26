// v26 M5 acceptance gate. The v26 design's primary acceptance was
// "below_ground.txt solves end-to-end" — that promise wasn't fully
// kept (vxBucket discretisation is coarser than the sub-pixel
// drift that affects this level's tight tolerances). What v26 M4
// DID deliver:
//
//   - Sub-pixel state-space A* architecture (cell × vxBucket) —
//     the foundation v27 needs to ship the full solve
//   - below_ground.txt PROGRESS: score 12 of 16 (v25 was 8)
//   - All v21-v25 agent-suite levels continue to solve
//   - CSS refactor: zero hardcoded dark backgrounds outside the
//     var-defining blocks
//   - Fit-to-screen draw-tile mismatch fixed
//
// This file asserts the agent-suite regression gate (the most
// important of the three M5 items per the impl plan) and
// documents below_ground's v26 progress.

// The below_ground plan() + simulate() progress check now lives in
// packages/agent/src/regression.test.ts; only the Test-button flows remain here.

import { test, expect, type Page } from '@playwright/test';

async function injectLevel(page: Page, text: string) {
  return page.evaluate((t: string) => {
    document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
    document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v26 M5 regression gate: every shipped agent-suite level solves', async ({ page }) => {
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
    // Close before next iteration.
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});

test('v26 M5: tower-cherry (v21 acceptance) still solves with multi-solution', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  const tower = `# name: untitled
# size: 24x14
# pickup-required: 1
${'.'.repeat(24)}
${'.'.repeat(24)}
${'.'.repeat(24)}
${'.'.repeat(24)}
${'.'.repeat(24)}
${'.'.repeat(24)}
.....o..................
...###..................
...###..................
...###........P......E..
########################
########################
########################
########################`;
  await injectLevel(page, tower);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  const pills = await page.locator('.stat-pill').allInnerTexts();
  expect(pills.some((t) => /1\s*pickup/i.test(t))).toBe(true);
});
