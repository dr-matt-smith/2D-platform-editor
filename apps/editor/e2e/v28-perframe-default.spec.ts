// v28 M4: default backend flips from 'bucket' (M3) to 'perframe'.
// plan() with no opts.planner uses the per-frame trajectory planner
// that solves below_ground end-to-end. The 'bucket' backend stays
// callable for diagnostics.

// The default-backend / bucket-backend checks now live in
// packages/agent/src/PlannerFactory.test.ts; only the Test-button sweep remains here.

import { test, expect } from '@playwright/test';

test('v28 M4: regression sweep — every shipped agent-suite level solves under the new default', async ({ page }) => {
  await page.goto('/apps/editor/');
  await page.waitForSelector('#preview');
  for (const file of ['tutorial.txt', 'simple.txt', 'above_ground.txt']) {
    const text = await page.evaluate(async (f) => {
      const r = await fetch('/data/levels/' + f);
      return r.ok ? await r.text() : null;
    }, file);
    expect(text, `level ${file} not fetched`).toBeTruthy();
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
