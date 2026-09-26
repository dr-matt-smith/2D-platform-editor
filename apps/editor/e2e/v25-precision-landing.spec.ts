// v25 M4: precision_landing edge rule. For each precision target
// (pickup cells + exit cells), if any action's trajectory passes
// within ±2 px of the target's CENTRE while descending, emit an
// additional edge to that target's cell. Lets the agent reach
// 1-tile pickups that the cell-resolved edge model misses.

// The trajectory + precision-edge checks now live in
// packages/agent/src/simAction.test.ts and grid.test.ts; only the Test-button
// flow remains here.

import { test } from '@playwright/test';

test('v25 M4: existing levels still solve (precision edges are additive)', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  // tutorial.txt — solvable since v24 M4; must still solve under
  // M4's added precision edges (they only add to the graph, never
  // remove existing edges).
  const text = await page.evaluate(async () => {
    const r = await fetch('/data/levels/tutorial.txt');
    return await r.text();
  });
  await page.evaluate((t) => {
    document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
    document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 6000 });
});
