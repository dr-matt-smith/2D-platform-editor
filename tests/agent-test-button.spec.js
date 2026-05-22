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
  // v22: trace list is open by default in the success dialog.
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

// --- v21 new cases ---------------------------------------------------

test('v21: searching state shows live countdown + cancel button', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // v25 fixup: inject below_ground.txt as the test level — it takes
  // the most planner work of any shipped level, so the searching
  // state is reliably visible for long enough for the assertions
  // below to land. The default level (tutorial) resolves too fast
  // post-v25 for the searching state to be observably distinct.
  const text = await page.evaluate(async () => {
    const r = await fetch('data/levels/below_ground.txt');
    return await r.text();
  });
  await injectLevel(page, text);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  // Dialog opens IMMEDIATELY in searching state — badge + countdown
  // + progress bar should all be present before the agent resolves.
  await page.waitForSelector('.badge.searching', { timeout: 1000 });
  await expect(page.locator('.countdown')).toBeVisible();
  await expect(page.locator('.countdown-bar')).toBeVisible();
  // Searching dialog shows the initial 5s budget.
  const countdownText = await page.locator('.countdown').innerText();
  expect(countdownText).toMatch(/\d+\.\ds/);
  // A Cancel button is available.
  await expect(page.locator('.cf-btn[data-act="close"]')).toBeVisible();
});

test('v21: failure dialog offers Try 10s / 15s / 20s escalation buttons', async ({ page }) => {
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
  await page.waitForSelector('.badge.fail', { timeout: 5000 });
  // Escalation row with three Try Ns buttons.
  await expect(page.locator('.cf-btn[data-act="try10"]')).toBeVisible();
  await expect(page.locator('.cf-btn[data-act="try15"]')).toBeVisible();
  await expect(page.locator('.cf-btn[data-act="try20"]')).toBeVisible();
});

test('v21: user-reported tower-cherry level now solves', async ({ page }) => {
  // The level the user reported as failing in v20.1: cherry on top of
  // a 3-wide tower; reach it then continue to the exit. v20.1's plan
  // collected the cherry but couldn't navigate back. v21's release-
  // direction-mid-jump unlock lets the agent land precisely on the
  // tower top, then walk off + continue.
  await page.goto('/');
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
  await page.waitForTimeout(400);

  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  // Stats should show 1 pickup collected (the cherry).
  const pillsText = await page.locator('.stat-pill').allInnerTexts();
  expect(pillsText.some((t) => /1\s*pickup/i.test(t))).toBe(true);
});

test('v21: above_ground.txt solves (v20.1 couldnt)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Load the shipped above_ground level.
  const text = await page.evaluate(async () => {
    const r = await fetch('data/levels/above_ground.txt');
    return r.ok ? await r.text() : null;
  });
  expect(text).toBeTruthy();
  await injectLevel(page, text);
  await page.waitForTimeout(400);

  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
});
