// v20 regression spec: the AI level-tester agent end-to-end.
//
// Asserts:
//   1. [Test] opens a dialog showing a solution for a solvable level,
//      with stats, a Demo button, and the trace list.
//   2. The path-overlay canvas paints (hash differs from cleared
//      baseline) — proves renderSolutionOverlay ran.
//   3. Demo button enters demomode, runs the recording, and auto-exits
//      back to edit mode within a reasonable window.
//   4. An unreachable level surfaces a failure dialog with the
//      "no solution" badge.

import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('agent: solvable level → success dialog with stats + trace + Demo', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(400);

  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog', { timeout: 5000 });

  // Success badge present.
  await expect(page.locator('.badge.ok')).toBeVisible();
  // Demo button present.
  await expect(page.locator('.cf-btn[data-act="demo"]')).toBeVisible();
  // Stats row has at least the steps + pickups pills.
  const pills = await page.locator('.stat-pill').count();
  expect(pills).toBeGreaterThanOrEqual(3);
  // Trace list reveals on click.
  await page.locator('.trace-section summary').click();
  await expect(page.locator('.trace-list li').first()).toBeVisible();
});

test('agent: path overlay paints when solution is found', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(400);

  // Snapshot the overlay's pixels BEFORE Test (should be blank).
  const hashBefore = await page.evaluate(() =>
    document.querySelector('#overlay').toDataURL('image/png'),
  );

  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog');

  // Snapshot AFTER — the overlay should now have the polyline + markers.
  const hashAfter = await page.evaluate(() =>
    document.querySelector('#overlay').toDataURL('image/png'),
  );

  const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');
  expect(sha(hashAfter)).not.toBe(sha(hashBefore));
});

test('agent: Demo replays the recording and auto-exits on win', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, '#####\n#P.E#\n#####');
  await page.waitForTimeout(400);

  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog');
  await page.locator('.cf-btn[data-act="demo"]').click();

  // Demo mode entered.
  await page.waitForFunction(
    () => document.body.classList.contains('demomode'),
    { timeout: 3000 },
  );
  // Demo runs through the recorded route → scene transitions to 'won' →
  // 1.5s banner hold → auto-exit. Allow 5s for the full cycle.
  await page.waitForFunction(
    () => !document.body.classList.contains('demomode'),
    { timeout: 5000 },
  );
});

test('agent: unreachable level → failure dialog with red badge', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const unreachable = [
    '##........##',
    '#P........E#',
    '##........##',
    '............',
    '............',
  ].join('\n');
  await injectLevel(page, unreachable);
  await page.waitForTimeout(400);

  await page.locator('#testBtn').click();
  await page.waitForSelector('.agent-dialog', { timeout: 5000 });
  await expect(page.locator('.badge.fail')).toBeVisible();
  // Stats / Demo button must NOT be present.
  await expect(page.locator('.cf-btn[data-act="demo"]')).toHaveCount(0);
});
