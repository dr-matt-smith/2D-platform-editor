// v29 M1: physics-adapter scaffolding. Asserts the `jsAdapter` shape
// the agent will depend on after M3 — TILE plus the two factory
// methods that wrap PlaytestScene + ScriptedInput. No agent code
// consumes the adapter yet; this just locks the contract.

import { test, expect } from '@playwright/test';

test('v29 M1: jsAdapter exposes TILE + factory methods', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { jsAdapter } = await import('/src/agent-adapter.js');
    return {
      tile: jsAdapter.TILE,
      hasMakeScene: typeof jsAdapter.makeScene === 'function',
      hasMakeScriptedInput: typeof jsAdapter.makeScriptedInput === 'function',
    };
  });
  expect(out.tile).toBe(20);
  expect(out.hasMakeScene).toBe(true);
  expect(out.hasMakeScriptedInput).toBe(true);
});

test('v29 M1: makeScene returns a PlaytestScene-shaped handle', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { jsAdapter } = await import('/src/agent-adapter.js');
    const { parse, DEFAULT_LEGEND } = await import('/src/level.js');
    const parsed = parse('#####\n#P.E#\n#####');
    const scene = jsAdapter.makeScene(parsed, DEFAULT_LEGEND, null);
    return {
      hasEnter: typeof scene.enter === 'function',
      hasUpdate: typeof scene.update === 'function',
      hasSetPlayerState: typeof scene.setPlayerState === 'function',
      hasPlayer: scene.player != null,
      hasCoins: Array.isArray(scene.coins),
      phase: scene.phase,
      hasMutableGame: scene.game != null && 'input' in scene.game,
    };
  });
  expect(out.hasEnter).toBe(true);
  expect(out.hasUpdate).toBe(true);
  expect(out.hasSetPlayerState).toBe(true);
  expect(out.hasPlayer).toBe(true);
  expect(out.hasCoins).toBe(true);
  expect(out.phase).toBe('play');
  expect(out.hasMutableGame).toBe(true);
});

test('v29 M1: makeScriptedInput returns an Input-shaped handle', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#preview');
  const out = await page.evaluate(async () => {
    const { jsAdapter } = await import('/src/agent-adapter.js');
    const si = jsAdapter.makeScriptedInput([]);
    return {
      hasAdvance: typeof si.advance === 'function',
      hasIsDown: typeof si.isDown === 'function',
      hasWasPressed: typeof si.wasPressed === 'function',
      hasEndFrame: typeof si.endFrame === 'function',
    };
  });
  expect(out.hasAdvance).toBe(true);
  expect(out.hasIsDown).toBe(true);
  expect(out.hasWasPressed).toBe(true);
  expect(out.hasEndFrame).toBe(true);
});
