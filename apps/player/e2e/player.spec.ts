// The standalone player: level picker, launching, keyboard play, Esc to
// the picker, and the readable message for a level that can't be played.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface ManifestEntry {
  id: string;
  name: string;
  file: string;
}
const manifest: ManifestEntry[] = JSON.parse(
  readFileSync('content/data/levels/manifest.json', 'utf8'),
);

const PLAYER = '/apps/player/';

// Collect uncaught page errors so each test can assert there were none.
function trackErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
}

const waitForState = (page: Page, state: string) =>
  expect(page.locator('body')).toHaveAttribute('data-state', state);

// True once the canvas has at least one non-transparent pixel.
function canvasHasPaint(page: Page): Promise<boolean> {
  return page.locator('#game').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });
}

test('loads the manifest into the level picker', async ({ page }) => {
  await page.goto(PLAYER);
  const options = page.locator('#level option');
  await expect(options).toHaveCount(manifest.length);
  await expect(options).toHaveText(manifest.map((l) => l.name));
});

test('launches the first level and paints the canvas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(PLAYER);
  await waitForState(page, 'playing');
  await expect(page.locator('#level')).toHaveValue(manifest[0].id);

  const box = await page.locator('#game').boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  await expect.poll(() => canvasHasPaint(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('?level=<id> selects that level', async ({ page }) => {
  const level = manifest[manifest.length - 1];
  await page.goto(`${PLAYER}?level=${level.id}`);
  await expect(page.locator('#level')).toHaveValue(level.id);
  await waitForState(page, 'playing');
});

test('choosing a level restarts play and updates the URL', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(PLAYER);
  await waitForState(page, 'playing');

  const level = manifest[1];
  await page.locator('#level').selectOption(level.id);
  await waitForState(page, 'playing');
  expect(new URL(page.url()).searchParams.get('level')).toBe(level.id);
  expect(errors).toEqual([]);
});

test('arrow keys play without errors; Esc returns to the picker', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(PLAYER);
  await waitForState(page, 'playing');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#level')).toHaveValue(manifest[0].id); // not changed by the arrows

  await page.keyboard.press('Escape');
  await waitForState(page, 'stopped');
  await expect(page.locator('#level')).toBeFocused();
  await expect(page.locator('#message')).toContainText('Enter or Space');

  // Enter starts the selected level again.
  await page.keyboard.press('Enter');
  await waitForState(page, 'playing');
  expect(errors).toEqual([]);
});

test('a level that fails the launch gate shows the reasons', async ({ page }) => {
  // Serve a level with no player spawn and no exit in place of the first one.
  await page.route(`**/data/levels/${manifest[0].file}`, (route) =>
    route.fulfill({ contentType: 'text/plain', body: '#####\n#   #\n#####\n' })
  );
  await page.goto(PLAYER);
  await waitForState(page, 'invalid');
  await expect(page.locator('#game')).toBeHidden();
  await expect(page.locator('#message li').first()).toContainText('Line');
});
