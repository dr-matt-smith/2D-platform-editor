// v27 M1: scrollbar-gutter: stable on .canvas-wrap. Without this,
// in FIT mode when the legend hides/minimises the wrap widens; fit
// math re-scales; canvas height creeps just past wrap height; a
// vertical scrollbar appears; clientWidth shrinks ~15 px; fit
// re-scales again; canvas shrinks; scrollbar may disappear; etc.
// The visible symptom is a "jog" the user reported. With
// scrollbar-gutter: stable the wrap reserves scrollbar space
// unconditionally — no bounce, no jog.

import { test, expect } from '@playwright/test';

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v27 M1: .canvas-wrap has scrollbar-gutter: stable', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const gutter = await page.locator('.canvas-wrap').evaluate((el) =>
    getComputedStyle(el).getPropertyValue('scrollbar-gutter').trim(),
  );
  expect(gutter).toBe('stable');
});

test('v27 M1: wrap clientWidth is invariant under scroll-state changes', async ({ page }) => {
  // The KEY invariant: clientWidth doesn't depend on whether a
  // vertical scrollbar is rendered. (In v26 it shrunk by ~15px
  // when the scrollbar appeared; in v27 the gutter is reserved
  // either way, so clientWidth is constant.) Force the scrollbar
  // to appear by making the wrap's content tall; compare
  // clientWidth before and after.
  await page.goto('/');
  await page.waitForSelector('#preview');
  const widths = await page.locator('.canvas-wrap').evaluate((el) => {
    const before = el.clientWidth;
    // Inject a tall element so the wrap has to scroll vertically.
    const spacer = document.createElement('div');
    spacer.style.height = '99999px';
    el.appendChild(spacer);
    const after = el.clientWidth;
    spacer.remove();
    return { before, after };
  });
  expect(widths.after).toBe(widths.before);
});

test('v27 M1: canvas horizontal position stable on Play-entry in FIT mode', async ({ page }) => {
  // The user-visible promise: clicking Play in FIT mode does not
  // cause the canvas to jog horizontally as the layout settles.
  await page.goto('/');
  await page.waitForSelector('#preview');
  await injectLevel(page, await page.evaluate(async () => {
    const r = await fetch('data/levels/below_ground.txt');
    return r.ok ? await r.text() : null;
  }));
  await page.waitForTimeout(200);
  // Legend visible.
  const isCollapsed = await page.evaluate(() =>
    document.body.classList.contains('legend-min'),
  );
  if (isCollapsed) {
    await page.locator('[data-act="legend-min"]').click();
    await page.waitForTimeout(80);
  }
  // Fit on.
  const fitActive = await page.locator('#fitBtn').evaluate((b) => b.classList.contains('active'));
  if (!fitActive) await page.locator('#fitBtn').click();
  await page.waitForTimeout(80);

  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));

  // Sample canvas left twice across a small settling window. With
  // v26 this could differ by ~15 px when a transient scrollbar
  // appears mid-fit; with v27 it's stable.
  const leftA = await page.locator('#preview').evaluate((c) => c.getBoundingClientRect().left);
  await page.waitForTimeout(200);
  const leftB = await page.locator('#preview').evaluate((c) => c.getBoundingClientRect().left);
  expect(Math.abs(leftB - leftA)).toBeLessThan(1);
});
