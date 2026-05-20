// v12: Movable pane splitter — end-to-end drag, persistence, and reset.
// Each Playwright test gets a fresh browser context (so a fresh empty
// localStorage), which is exactly what we want — each scenario starts
// from the 50/50 default and ends having proved its own assertion.
import { test, expect } from '@playwright/test';

// Helpers that read the live computed widths from the page rather than
// trusting `--left-pct` or storage values (a real-pixel check is what
// the user sees).
const widthOf = (page, selector) =>
  page.locator(selector).evaluate((el) => el.getBoundingClientRect().width);

async function dragSplitter(page, dxPx) {
  const box = await page.locator('#splitter').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dxPx, cy, { steps: 8 });
  await page.mouse.up();
}

test('splitter: drag widens the left pane (live)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitter'));

  const before = await widthOf(page, '.pane.left');
  await dragSplitter(page, 120);
  const after = await widthOf(page, '.pane.left');

  // Allow a couple of pixels of clamping/rounding slack but require
  // the drag clearly took.
  expect(after).toBeGreaterThan(before + 100);
});

test('splitter: width is persisted across a page reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitter'));

  await dragSplitter(page, 150);
  const dragged = await widthOf(page, '.pane.left');

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('#splitter'));
  const reloaded = await widthOf(page, '.pane.left');

  // The persisted px width is read on the next page load and applied
  // before first paint; allow ≤3 px slack for sub-pixel layout drift.
  expect(Math.abs(reloaded - dragged)).toBeLessThan(3);
});

test('splitter: double-click resets to 50/50', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitter'));

  // Move it off-centre first so the reset has something to undo.
  await dragSplitter(page, 200);
  const dragged = await widthOf(page, '.pane.left');
  expect(dragged).toBeGreaterThan(700);

  await page.locator('#splitter').dblclick();
  const reset = await widthOf(page, '.pane.left');

  // The viewport is 1280 (playwright.config.js); 50% of that minus the
  // splitter's share is ~637 px. Allow a small slack for rounding.
  const viewport = page.viewportSize().width;
  expect(Math.abs(reset - viewport / 2)).toBeLessThan(10);
});

test('splitter: drag is clamped — neither pane can go below 220 px', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitter'));

  // Yank way past the right clamp.
  await dragSplitter(page, 2000);
  const tooFarRight = await widthOf(page, '.pane.left');
  expect(tooFarRight).toBeLessThanOrEqual(page.viewportSize().width - 220 + 1);

  // Reset and yank past the left clamp.
  await page.locator('#splitter').dblclick();
  await dragSplitter(page, -2000);
  const tooFarLeft = await widthOf(page, '.pane.left');
  expect(tooFarLeft).toBeGreaterThanOrEqual(220 - 1);
});

// --- v13: vertical splitter for the problems panel --------------------

const heightOf = (page, selector) =>
  page.locator(selector).evaluate((el) => el.getBoundingClientRect().height);

async function dragSplitterH(page, dyPx) {
  const box = await page.locator('#splitterH').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Negative dy = move UP = problems panel grows. Positive dy = down,
  // panel shrinks (clamped at min 60).
  await page.mouse.move(cx, cy + dyPx, { steps: 8 });
  await page.mouse.up();
}

test('problems splitter: drag UP grows the problems panel (live)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitterH'));

  const before = await heightOf(page, '.problems');
  // Drag the bar up by 100 px → the panel below it gains ≈ 100 px.
  await dragSplitterH(page, -100);
  const after = await heightOf(page, '.problems');

  expect(after).toBeGreaterThan(before + 80);
});

test('problems splitter: height is persisted across a page reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitterH'));

  await dragSplitterH(page, -150);
  const dragged = await heightOf(page, '.problems');

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('#splitterH'));
  const reloaded = await heightOf(page, '.problems');

  expect(Math.abs(reloaded - dragged)).toBeLessThan(3);
});

test('problems splitter: double-click resets to ~25vh', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitterH'));

  // Move it off-default first.
  await dragSplitterH(page, -200);
  expect(await heightOf(page, '.problems')).toBeGreaterThan(350);

  await page.locator('#splitterH').dblclick();
  const reset = await heightOf(page, '.problems');

  // CSS default is 25vh; viewport is 800 (playwright.config.js) → 200.
  // Allow ±15 px for borders, scrollbars, sub-pixel rounding.
  const vh = page.viewportSize().height;
  expect(Math.abs(reset - vh * 0.25)).toBeLessThan(15);
});

test('problems splitter: drag is clamped — panel ≥60 px, editor ≥240 px', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!document.querySelector('#splitterH'));

  // Yank way down — panel should clamp to its min (60 px).
  await dragSplitterH(page, 2000);
  const tooFarDown = await heightOf(page, '.problems');
  expect(tooFarDown).toBeGreaterThanOrEqual(60 - 1);
  expect(tooFarDown).toBeLessThanOrEqual(80); // close to 60

  // Reset, then yank way up — editor's 240 px min stops the panel
  // from claiming the whole viewport.
  await page.locator('#splitterH').dblclick();
  await dragSplitterH(page, -2000);
  const panel = await heightOf(page, '.problems');
  const editor = await heightOf(page, '.editor');
  expect(editor).toBeGreaterThanOrEqual(240 - 1);
  // And the panel is at most viewport - 240 - 6 (the bar) − a couple of px slack.
  expect(panel).toBeLessThanOrEqual(page.viewportSize().height - 240);
});
