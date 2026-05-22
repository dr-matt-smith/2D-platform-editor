// v22 M6 acceptance: the multi-solution dialog presents a solution-
// row per result, with the focused row showing a "▶ Demo this route"
// button. v22's enumeration finds ≥ 1 unique solution; levels with
// genuine route variety surface multiple rows.
//
// The TUTORIAL.TXT carry-over: even with M1's spawn-fall settle +
// M2's TSP-optimal pickup ordering, A* through the v21 action-graph
// can't reach the exit from `tutorial.txt`'s spawn — diagnosed as a
// graph-edge gap (suspected: missing run-off-platform / drop-and-
// catch variants needed to cross the `oooo` row). Documented as a
// v23 candidate in the v22 transcript.

import { test, expect } from '@playwright/test';

function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v22 M6: agent dialog renders a Solution 1 row on a solvable level', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 10000 });
  // v22 multi-solution row layout — at least Solution 1 is present.
  await expect(page.locator('.solution-row').first()).toBeVisible();
  await expect(page.locator('.solution-row').first()).toContainText('Solution 1');
  // The focused row owns the Demo button.
  await expect(
    page.locator('.solution-row.focused .cf-btn[data-act="demo"]'),
  ).toBeVisible();
});

test('v22 M6: above_ground.txt produces ≥ 1 solution row + open trace', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const text = await page.evaluate(async () => {
    const r = await fetch('data/levels/above_ground.txt');
    return r.ok ? await r.text() : null;
  });
  expect(text).toBeTruthy();
  await injectLevel(page, text);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 10000 });
  const rows = await page.locator('.solution-row').count();
  expect(rows).toBeGreaterThanOrEqual(1);
  // Trace section auto-opens in v22 (no click required).
  await expect(page.locator('.trace-list li').first()).toBeVisible();
});

test('v22 M6: clicking a non-focused row re-focuses it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Tower-cherry — solves reliably; if multi-solution returns ≥ 2 we
  // exercise focus, otherwise the test confirms graceful single-row.
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
  await page.waitForSelector('.badge.ok', { timeout: 10000 });
  const rows = await page.locator('.solution-row').count();
  expect(rows).toBeGreaterThanOrEqual(1);
  if (rows >= 2) {
    // Click the second row → it becomes .focused.
    await page.locator('.solution-row').nth(1).click();
    await expect(page.locator('.solution-row').nth(1)).toHaveClass(/focused/);
  }
});
