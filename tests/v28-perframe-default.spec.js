// v28 M4: default backend flips from 'bucket' (M3) to 'perframe'.
// plan() with no opts.planner uses the per-frame trajectory planner
// that solves below_ground end-to-end. The 'bucket' backend stays
// callable for diagnostics.

import { test, expect } from '@playwright/test';

test('v28 M4: default backend is now perframe', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { plan } = await import('/src/agent/planner.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const p = plan(parsed, DEFAULT_LEGEND);
    // Perframe trace entries have edgeId starting with 'perframe'.
    return { firstEdgeId: p.trace[0]?.edgeId ?? null };
  });
  expect(out.firstEdgeId).toBeTruthy();
  expect(out.firstEdgeId.startsWith('perframe')).toBe(true);
});

test('v28 M4: opts.planner=bucket still callable for diagnostics', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const { plan } = await import('/src/agent/planner.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const p = plan(parsed, DEFAULT_LEGEND, { planner: 'bucket' });
    return { firstEdgeId: p.trace[0]?.edgeId ?? null };
  });
  expect(out.firstEdgeId).toBeTruthy();
  // Bucket edgeIds look like "r,c,vx,xo>r,c,vx,xo:kind".
  expect(out.firstEdgeId.startsWith('perframe')).toBe(false);
});

test('v28 M4: regression sweep — every shipped agent-suite level solves under the new default', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  for (const file of ['tutorial.txt', 'simple.txt', 'above_ground.txt']) {
    const text = await page.evaluate(async (f) => {
      const r = await fetch('data/levels/' + f);
      return r.ok ? await r.text() : null;
    }, file);
    expect(text, `level ${file} not fetched`).toBeTruthy();
    await page.evaluate((t) => {
      document.querySelector('#src').value = t;
      document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    await page.waitForTimeout(300);
    await page.locator('#testBtn').click();
    await page.waitForSelector('.badge.ok', { timeout: 8000 });
    await page.locator('.cf-btn[data-act="close"]').click();
    await page.waitForSelector('.modal-backdrop', { state: 'detached' });
  }
});
