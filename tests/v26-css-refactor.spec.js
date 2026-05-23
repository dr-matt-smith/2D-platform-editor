// v26 M2: verify the substitution sweep is complete. After the
// refactor, only the `:root { ... }` block and the
// `body.lightmode { ... }` block should contain hardcoded
// dark-control hex values — everywhere else uses var(--ctl-bg) /
// var(--input-bg) / var(--row-hover) / etc.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', 'src', 'style.css');

test('v26 M2: no residual `background: #1d1d20/#2d2d30/#333/#3d3d40` outside var blocks', async () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const lines = css.split('\n');
  const offenders = [];
  // Track whether we're inside the var-defining block (where these
  // values legally appear as the dark side of a var binding).
  let inRootBlock = false;
  let inLightmodeBlock = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^:root\s*\{/.test(line)) { inRootBlock = true; depth = 1; continue; }
    if (/^body\.lightmode\s*\{/.test(line)) { inLightmodeBlock = true; depth = 1; continue; }
    if (inRootBlock || inLightmodeBlock) {
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (depth <= 0) {
        inRootBlock = false;
        inLightmodeBlock = false;
        depth = 0;
      }
      continue;
    }
    // Outside the var blocks — these hex values are forbidden in
    // `background:` declarations.
    if (/background:\s*#(1d1d20|2d2d30|333|3d3d40|2a2a2a|1e3b29|3b1e1e|2a2d3a)\b/i.test(line)) {
      offenders.push({ line: i + 1, text: line.trim() });
    }
  }
  expect(offenders).toEqual([]);
});

test('v26 M2: lightmode + dark mode rules still render distinct stat-pill backgrounds', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.waitForSelector('#preview');
  // Force dark mode regardless of localStorage / OS.
  await page.evaluate(() => localStorage.setItem('v23.theme', 'dark'));
  await page.reload();
  await page.waitForSelector('#preview');
  // Inject a solvable level so the Test dialog populates with
  // stat-pills.
  await page.evaluate(() => {
    document.querySelector('#src').value = '#######\n#P.o.E#\n#######';
    document.querySelector('#src').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  const darkBg = await page.locator('.stat-pill').first().evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  // Dark mode stat-pill bg ≈ #1d1d20 → rgb(29, 29, 32).
  const darkRgb = darkBg.replace(/[^\d,]/g, '').split(',').map(Number);
  expect(darkRgb[0]).toBeLessThan(50);
  // Close + switch to light.
  await page.locator('.cf-btn[data-act="close"]').click();
  await page.locator('#themeBtn').click();
  await page.locator('#testBtn').click();
  await page.waitForSelector('.badge.ok', { timeout: 8000 });
  const lightBg = await page.locator('.stat-pill').first().evaluate((el) =>
    getComputedStyle(el).backgroundColor,
  );
  const lightRgb = lightBg.replace(/[^\d,]/g, '').split(',').map(Number);
  // Light mode stat-pill bg ≈ #ffffff → rgb(255, 255, 255).
  expect(lightRgb[0]).toBeGreaterThan(200);
});
