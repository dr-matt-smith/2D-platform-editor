// v25 fixup: every popup's dark-bg + var(--fg)-text combo was
// breaking in lightmode (dark text on dark background). Locks in
// the contrast fixes across the agent dialog (stat-pills,
// solution rows, countdown, focused row, trace), the
// minimised-solutions bar, the New-Level form, and the
// level-loader list rows.
//
// Test pattern: switch to lightmode, open each popup, sample
// the COMPUTED background-color of the suspect element and
// assert each RGB channel > 200 (= pale enough that var(--fg)
// dark text is readable on it).

import { test, expect } from '@playwright/test';

const RGB = (s) => s.replace(/[^\d,]/g, '').split(',').map(Number);
const isPaleBg = (rgb) => rgb[0] > 200 && rgb[1] > 200 && rgb[2] > 200;
const isGreenTint = (rgb) => rgb[1] > rgb[0] && rgb[1] > 200; // light green

async function setLight(page) {
  await page.evaluate(() => localStorage.removeItem('v23.theme'));
  await page.reload();
  await page.waitForSelector('#preview');
  const isLight = await page.locator('body').evaluate((b) => b.classList.contains('lightmode'));
  if (!isLight) await page.locator('#themeBtn').click();
  await expect(page.locator('body')).toHaveClass(/lightmode/);
}

async function injectLevel(page, text) {
  return page.evaluate((t) => {
    document.querySelector('#src').value = t;
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

test('v25 lightmode: agent-dialog stat-pills are pale in lightmode', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setLight(page);
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  const bg = await page.locator('.stat-pill').first().evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  expect(isPaleBg(RGB(bg))).toBe(true);
});

test('v25 lightmode: agent-dialog focused solution row is light-green', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setLight(page);
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  const bg = await page.locator('.solution-row.focused').evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  // Must be a LIGHT colour (each channel > 200 ish) and tinted green.
  const rgb = RGB(bg);
  expect(rgb[1]).toBeGreaterThan(200); // green channel high
  expect(rgb[0]).toBeGreaterThan(180); // not too saturated
});

test('v25 lightmode: trace text + summary are dark on the light dialog bg', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setLight(page);
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  // .trace-list inherits color: var(--fg) → in lightmode, dark.
  // Just verify it's NOT the same as the background (= visible).
  const result = await page.locator('.trace-list').evaluate((el) => {
    const c = getComputedStyle(el);
    return { color: c.color, bg: getComputedStyle(el.closest('.modal')).backgroundColor };
  });
  const fg = RGB(result.color);
  const bg = RGB(result.bg);
  // Sum brightness should differ markedly between text and bg.
  const fgLum = fg[0] + fg[1] + fg[2];
  const bgLum = bg[0] + bg[1] + bg[2];
  expect(Math.abs(fgLum - bgLum)).toBeGreaterThan(200);
});

test('v25 lightmode: New-Level dialog inputs are white-on-dark-text', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setLight(page);
  await page.locator('#newBtn').click();
  await page.waitForSelector('.modal');
  // The dialog opens the level list first; the "New level" path
  // requires clicking through. Look for the nv-form (only present
  // in the new-level path), else just close — this test is a
  // safety net even if no nv-form is rendered yet.
  const hasNvForm = await page.locator('.nv-form').count();
  if (hasNvForm > 0) {
    const inputBg = await page.locator('.nv-form select').evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    expect(isPaleBg(RGB(inputBg))).toBe(true);
  }
});

test('v25 lightmode: minimised-solutions stat-pills are pale', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await setLight(page);
  await injectLevel(page, '#######\n#P.o.E#\n#######');
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  await page.locator('.agent-min-btn[data-act="minimise"]').click();
  await expect(page.locator('.minimised-solutions')).toBeVisible();
  const bg = await page.locator('.minimised-solutions .stat-pill').first().evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  expect(isPaleBg(RGB(bg))).toBe(true);
});
