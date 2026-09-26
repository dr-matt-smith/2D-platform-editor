// v26 M4: nav-graph node identity is now (cell, vxBucket). Each
// walkable cell expands to 3 nodes — one per vxBucket ∈ {-1, 0, +1}.
// A* operates on these richer keys; goal-matching accepts any
// vxBucket variant of the target cell.

// The node-count, stateKey-helper and A* checks now live in
// packages/agent/src/grid.test.ts and planner.test.ts; only the Test-button
// flow remains here.

import { test, expect } from '@playwright/test';

test('v26 M4: existing v25 levels still solve under bucket-aware A*', async ({ page }) => {
  // The acceptance gate: agent-suite levels v22-v25 already solved
  // must continue solving. above_ground was the v24 M5 regression
  // risk; tutorial.txt was v24's level redesign.
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
    // Close the dialog for the next level.
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
