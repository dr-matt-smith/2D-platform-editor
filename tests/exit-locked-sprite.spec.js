// v22.1: locked-exit sprite variant. When the tileset declares both
// `glyphs.exit.image` and `glyphs.exit.imageLocked`, the in-game
// renderer paints the locked variant while `meetsPickupRequirement`
// is false, and swaps to the primary as soon as the requirement is
// met. The Dirt_Platformer_Tiles ships with green (unlocked) +
// red (locked); we drive a 1-pickup level and sample the exit cell.

import { test, expect } from '@playwright/test';

async function injectLevelText(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function setTileset(page, id) {
  // Switch the active tileset via the toolbar <select>. The on-disk
  // JSON is what's under test.
  await page.evaluate((tid) => {
    const sel = document.querySelector('#tilesetSel');
    sel.value = tid;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, id);
  await page.waitForTimeout(300);
}
const setDirt = (page) => setTileset(page, 'Dirt_Platformer_Tiles');
const setPeas = (page) => setTileset(page, 'PlayWithYourPeas');

test('v22.1: exit paints RED (locked) when pickup-required not met, GREEN after', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setDirt(page);
  // 1-pickup-required level. P spawns next to the cherry; E is 2 cells
  // to the right of the cherry. Walking right collects the cherry,
  // unlocking the exit.
  const level = [
    '# pickup-required: 1',
    '##########',
    '#.P.o..E.#',
    '##########',
  ].join('\n');
  await injectLevelText(page, level);
  await page.waitForTimeout(400);

  // Enter Play. The first paint should show a RED flag at the exit
  // because pickup-required: 1 isn't met (score = 0).
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);

  // Sample the centre of the exit cell. PlaytestScene uses engine
  // TILE=20; the exit is at row 1, col 7. v27 M2: HUD strip (20 px)
  // sits above the level, so canvas y = HUD + 1*20 + 10 = 50.
  const sampleAtExit = () => page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    // Sample a 5×5 patch and average — flag sprites have a mast +
    // cloth so the centre pixel may be transparent; averaging avoids
    // false negatives.
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const px = [...ctx.getImageData(150 + dx, 50 + dy, 1, 1).data];
        r += px[0]; g += px[1]; b += px[2]; n++;
      }
    }
    return [r / n, g / n, b / n];
  });

  const lockedPixel = await sampleAtExit();
  // RED flag — red channel dominates green; cloth saturates the
  // patch even after averaging in some sky pixels at the corners.
  expect(lockedPixel[0]).toBeGreaterThan(lockedPixel[1] + 10);
  expect(lockedPixel[0]).toBeGreaterThan(lockedPixel[2] + 10);

  // Walk right just far enough to collect the cherry but stop short
  // of the exit. P at col 2 → cherry at col 4 = 40 px = ~170 ms at
  // 240 px/s. 250 ms gives margin without reaching col 7 (exit).
  // Stopping pre-exit keeps the scene in 'play' phase so the sample
  // isn't darkened by the won-banner overlay.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);

  // Sample again — the SWAP is the observable, so compare to the
  // locked sample: green channel rises, red channel drops. (Avoids
  // depending on the exact RGB of the green PNG cloth, which after
  // averaging over a 9×9 patch with sky bleed is close to neutral.)
  const unlockedPixel = await sampleAtExit();
  expect(unlockedPixel[1] - lockedPixel[1]).toBeGreaterThan(5); // greener
  expect(lockedPixel[0] - unlockedPixel[0]).toBeGreaterThan(5); // less red
});

test('v22.1: editor preview always shows the UNLOCKED variant (green)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setDirt(page);
  // pickup-required: 5 but no pickups in the level — locked at runtime,
  // but the editor preview is state-less and should ALWAYS show green.
  const level = [
    '# pickup-required: 5',
    '##########',
    '#.P....E.#',
    '##########',
  ].join('\n');
  await injectLevelText(page, level);
  await page.waitForTimeout(400);
  const sampleAtExit = () => page.evaluate(() => {
    const ctx = document.querySelector('#preview').getContext('2d');
    // Editor TILE=24; col 7 row 1. v27 M2: HUD strip (24 px) above
    // the level → canvas y = HUD + 1*24 + 12 = 60.
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const px = [...ctx.getImageData(180 + dx, 60 + dy, 1, 1).data];
        r += px[0]; g += px[1]; b += px[2]; n++;
      }
    }
    return [r / n, g / n, b / n];
  });
  const pixel = await sampleAtExit();
  // Green dominates in edit mode regardless of pickup-required.
  expect(pixel[1]).toBeGreaterThan(pixel[0] + 5);
});

test('v22.1: PlayWithYourPeas exit sprite swaps Bad → Good after collecting', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setPeas(page);
  // Same 1-pickup level shape as the Dirt test; PWYP wires Flag-Bad
  // (locked) and Flag-Good (unlocked) for the exit.
  const level = [
    '# pickup-required: 1',
    '##########',
    '#.P.o..E.#',
    '##########',
  ].join('\n');
  await injectLevelText(page, level);
  await page.waitForTimeout(400);

  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.body.classList.contains('playmode'));
  await page.waitForTimeout(100);

  // PNG hashing the exit-cell rectangle is the most robust signal —
  // Flag-Bad and Flag-Good have different cloth pixels regardless of
  // their exact RGB. (Some packs use sepia / dim tones we can't
  // assume saturated red/green for.) The HASH MUST DIFFER pre/post.
  const exitCellHash = () => page.evaluate(async () => {
    const ctx = document.querySelector('#preview').getContext('2d');
    // PWYP renders at engine TILE=20; exit cell is col 7 row 1.
    // v27 M2: HUD strip (20 px) above level → canvas rect (140, 40, 20, 20).
    const data = ctx.getImageData(140, 40, 20, 20).data;
    // Quick FNV-1a-ish 32-bit roll over the channel bytes.
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < data.length; i++) {
      h = (h ^ data[i]) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  });

  const hashLocked = await exitCellHash();
  // Drive the player right to collect the cherry.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  const hashUnlocked = await exitCellHash();
  // The two hashes must differ — proves the locked variant painted
  // first and the primary painted after the requirement was met.
  expect(hashLocked).not.toBe(hashUnlocked);
});
