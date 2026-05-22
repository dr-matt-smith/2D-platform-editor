// v22 M4: legend layout — defaults to right side; min/max collapse;
// right ↔ bottom swap; fit-to-screen toggle; all persisted via
// localStorage.

import { test, expect } from '@playwright/test';

test('v22: legend defaults to right-side layout on first load', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // pane.right has the layout-right class on initial render.
  await expect(page.locator('.pane.right')).toHaveClass(/layout-right/);
});

test('v22: minimise button collapses the legend body', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Legend body visible initially.
  await expect(page.locator('.legend .legend-body')).toBeVisible();
  // Click the [—] toggle.
  await page.locator('.legend-toggle[data-act="legend-min"]').first().click();
  // Collapsed: pane.right has legend-collapsed class; body is hidden.
  await expect(page.locator('.pane.right')).toHaveClass(/legend-collapsed/);
  await expect(page.locator('.legend .legend-body')).toBeHidden();
  // Click again — re-expands.
  await page.locator('.legend-toggle[data-act="legend-min"]').first().click();
  await expect(page.locator('.pane.right')).not.toHaveClass(/legend-collapsed/);
  await expect(page.locator('.legend .legend-body')).toBeVisible();
});

test('v22: swap button toggles right ↔ bottom layout', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await expect(page.locator('.pane.right')).toHaveClass(/layout-right/);
  // Click [↕].
  await page.locator('.legend-toggle[data-act="legend-swap"]').first().click();
  await expect(page.locator('.pane.right')).toHaveClass(/layout-bottom/);
  await expect(page.locator('.pane.right')).not.toHaveClass(/layout-right/);
  // Toggle back.
  await page.locator('.legend-toggle[data-act="legend-swap"]').first().click();
  await expect(page.locator('.pane.right')).toHaveClass(/layout-right/);
});

test('v22: fit-to-screen toggle scales the canvas inline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Initially: no inline width on #preview.
  const before = await page.locator('#preview').evaluate((c) => c.style.width);
  expect(before).toBe('');
  // Click [⛶ Fit].
  await page.locator('#fitBtn').click();
  // Now an inline width has been set.
  const after = await page.locator('#preview').evaluate((c) => c.style.width);
  expect(after).toMatch(/\d+px/);
  // Button has .active class.
  await expect(page.locator('#fitBtn')).toHaveClass(/active/);
  // Click again — clears.
  await page.locator('#fitBtn').click();
  const cleared = await page.locator('#preview').evaluate((c) => c.style.width);
  expect(cleared).toBe('');
});

test('v22: fit-mode re-fits when legend is minimised', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Turn on fit-mode.
  await page.locator('#fitBtn').click();
  const widthWithLegendExpanded = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  expect(widthWithLegendExpanded).toBeGreaterThan(0);
  // Minimise the legend — the canvas-wrap widens by ~184 px.
  await page.locator('.legend-toggle[data-act="legend-min"]').first().click();
  await page.waitForTimeout(50);
  const widthWithLegendCollapsed = await page.locator('#preview').evaluate((c) =>
    parseFloat(c.style.width || '0'),
  );
  expect(widthWithLegendCollapsed).toBeGreaterThan(widthWithLegendExpanded);
});

test('v22: layout + collapsed + fit choices persist across reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Toggle each setting.
  await page.locator('.legend-toggle[data-act="legend-swap"]').first().click(); // → bottom
  await page.locator('.legend-toggle[data-act="legend-min"]').first().click(); // collapsed
  await page.locator('#fitBtn').click(); // fit on
  // Reload.
  await page.reload();
  await page.waitForSelector('#preview');
  // All three restored.
  await expect(page.locator('.pane.right')).toHaveClass(/layout-bottom/);
  await expect(page.locator('.pane.right')).toHaveClass(/legend-collapsed/);
  await expect(page.locator('#fitBtn')).toHaveClass(/active/);
  // Reset state for next test (other tests assume the default).
  await page.locator('.legend-toggle[data-act="legend-swap"]').first().click();
  await page.locator('.legend-toggle[data-act="legend-min"]').first().click();
  await page.locator('#fitBtn').click();
});
