// v24 M4: tutorial.txt is now physically solvable. v23 diagnosed
// the original level as having no path between the row-4 ooo
// platform and the row-2 exit (jumps from row 4 clipped the row-0
// ceiling and fell back to row 8). v24 ships a level redesign:
// row 3 cols 14-22 extended to `#` so the right-side platform
// reaches further left; a jump from (4, 12) now lands on (2, 15)
// or thereabouts, and the player can walk right to the exit.

import { test, expect } from '@playwright/test';

test('v24 M4: tutorial.txt solves within 5s + ≥ 4 pickups', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const text = await page.evaluate(async () => {
    const r = await fetch('data/levels/tutorial.txt');
    return r.ok ? await r.text() : null;
  });
  expect(text).toBeTruthy();
  await page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.waitForTimeout(400);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 6000 });
  // Stat pills include "4 pickups" (the ooo row).
  const pills = await page.locator('.stat-pill').allInnerTexts();
  const hasFourPickups = pills.some((t) => /4\s*pickups?/i.test(t));
  expect(hasFourPickups).toBe(true);
});
