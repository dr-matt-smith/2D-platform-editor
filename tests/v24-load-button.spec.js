// v24 M1: LOAD button. Opens a paste-text modal; pasted text →
// parse + validate → save via levels.addLocal → add to dropdown
// + switch to it. Invalid text surfaces an error in the modal and
// keeps it open.

import { test, expect } from '@playwright/test';

async function clearLocals(page) {
  await page.evaluate(() => {
    // Wipe any local-* drafts + the locals list from a previous run.
    const remove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('ld:v3:draft:local-') || k === 'ld:v24:locals') remove.push(k);
    }
    for (const k of remove) localStorage.removeItem(k);
  });
}

test('v24 M1: [Load] opens the paste-text modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearLocals(page);
  await expect(page.locator('#loadBtn')).toBeVisible();
  await page.locator('#loadBtn').click();
  await expect(page.locator('.paste-load-dialog')).toBeVisible();
  await expect(page.locator('.paste-load-dialog #pl-text')).toBeFocused();
  // Cancel closes.
  await page.locator('.paste-load-dialog [data-act="cancel"]').click();
  await expect(page.locator('.paste-load-dialog')).toHaveCount(0);
});

test('v24 M1: pasting valid text creates a local-* entry + switches to it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearLocals(page);
  const optionsBefore = await page.locator('#levelSel option').count();
  await page.locator('#loadBtn').click();
  await expect(page.locator('.paste-load-dialog')).toBeVisible();
  await page.locator('#pl-text').fill('# name: pasted-level\n##########\n#P......E#\n##########');
  await page.locator('.paste-load-dialog [data-act="load"]').click();
  await expect(page.locator('.paste-load-dialog')).toHaveCount(0);
  // levelSel now has one more option than before, and it's selected.
  const optionsAfter = await page.locator('#levelSel option').count();
  expect(optionsAfter).toBe(optionsBefore + 1);
  const selected = await page.locator('#levelSel').inputValue();
  expect(selected).toMatch(/^local-[a-z0-9]{8}$/);
  // Buffer contains the pasted text.
  const text = await page.locator('#src').inputValue();
  expect(text).toContain('# name: pasted-level');
  expect(text).toContain('#P......E#');
});

test('v24 M1: invalid (empty) text surfaces inline error, modal stays open', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearLocals(page);
  await page.locator('#loadBtn').click();
  await page.locator('#pl-text').fill('');
  await page.locator('.paste-load-dialog [data-act="load"]').click();
  // Modal stays open; error surfaced.
  await expect(page.locator('.paste-load-dialog')).toBeVisible();
  await expect(page.locator('.pl-error')).toBeVisible();
});

test('v24 M1: display-name input defaults to the # name: directive', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearLocals(page);
  await page.locator('#loadBtn').click();
  await page.locator('#pl-text').fill('# name: my-imported-level\n#####\n#P.E#\n#####');
  // Leave the name input blank — the load handler picks up the directive.
  await page.locator('.paste-load-dialog [data-act="load"]').click();
  await expect(page.locator('.paste-load-dialog')).toHaveCount(0);
  // The new local-* option's label includes the imported name.
  const optionText = await page.locator('#levelSel option:checked').innerText();
  expect(optionText).toContain('my-imported-level');
});

test('v24 M1: local entry persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  await clearLocals(page);
  await page.locator('#loadBtn').click();
  await page.locator('#pl-text').fill('# name: persist-test\n#####\n#P.E#\n#####');
  await page.locator('.paste-load-dialog [data-act="load"]').click();
  const idBefore = await page.locator('#levelSel').inputValue();
  // Reload — the local entry should still be in the dropdown.
  await page.reload();
  await page.waitForSelector('#preview');
  const options = await page.locator('#levelSel option').evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, text: o.innerText })),
  );
  expect(options.some((o) => o.value === idBefore)).toBe(true);
  // Cleanup.
  await clearLocals(page);
});
