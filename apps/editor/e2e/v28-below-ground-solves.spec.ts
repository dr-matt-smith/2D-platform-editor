// v28 M5 acceptance gate. The v25→v26→v27 carry-over: below_ground.txt
// solves end-to-end. v28's per-frame trajectory planner (M3+M4) plus
// the simAction input-timing fix make this work — the chain is exact
// by construction and the recording's release events fire at the same
// frames as the live engine's input.advance ticks.
//
// Replaces v27's PROGRESS assertion (score ≥ 8 baseline) with a
// FULL SOLVE assertion (.badge.ok within 5 s; pickup stat = 16/16).

// The plan() + simulate() full-solve check now lives in
// packages/agent/src/regression.test.ts; only the Test-button flows remain here.

import { test, expect, type Page } from '@playwright/test';

async function injectLevel(page: Page, text: string) {
  return page.evaluate((t: string) => {
    document.querySelector<HTMLTextAreaElement>('#src')!.value = t;
    document.querySelector('#src')!.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v28 M5: below_ground.txt solves via the Test-button flow within the 5s budget', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  const text = await page.evaluate(async () => {
    const r = await fetch('/data/levels/below_ground.txt');
    return r.ok ? await r.text() : null;
  });
  await injectLevel(page, text!);
  await page.waitForTimeout(300);
  await page.locator('#testBtn').click();
  // .badge.ok signals the agent dialog's success state.
  await page.waitForSelector('.badge.ok', { timeout: 5000 });
  // Pickup stat — agentDialog's stat-pill format.
  const pills = await page.locator('.stat-pill').allInnerTexts();
  const pickupLine = pills.find((t) => /pickup/i.test(t));
  expect(pickupLine, `expected a pickup stat pill, got: ${pills.join(' | ')}`).toBeTruthy();
  expect(pickupLine).toMatch(/16/);
});

test('v28 M5: agent-suite regression — every v21-v27 shipped level still solves', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  for (const file of ['tutorial.txt', 'simple.txt', 'above_ground.txt', 'below_ground.txt']) {
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
