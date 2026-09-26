// v27 M4: nav-graph node identity expands to (cell, vxBucket,
// xOffsetBucket). Each grounded cell now produces 3 × 3 = 9 nodes —
// vxBucket ∈ {-1, 0, +1} × xOffsetBucket ∈ {'L', 'C', 'R'}. A*
// goal-matching by cell prefix still accepts any of the 9 variants.
// This spec covers the new helpers + the 9× node-count + the
// expected stateKey shape.

// The node-count and xOffsetBucket/stateKey/bucketCentreX helper checks now
// live in packages/agent/src/grid.test.ts; only the Test-button flow remains here.

import { test, expect } from '@playwright/test';

test('v27 M4: existing v25/v26 levels still solve under 9× state-space A*', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  for (const file of ['above_ground.txt', 'tutorial.txt']) {
    const text = await page.evaluate(async (f) => {
      const r = await fetch('/data/levels/' + f);
      return r.ok ? await r.text() : null;
    }, file);
    expect(text).toBeTruthy();
    await page.evaluate((t) => {
      document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
      document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
    }, text!);
    await page.waitForTimeout(300);
    await page.locator('#testBtn').click();
    await page.waitForSelector('.badge.ok', { timeout: 8000 });
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
