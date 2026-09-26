// v29 M4: workspace scaffolding. The root deno.json declares the
// packages/agent workspace member; packages/agent/deno.json is the
// carved-out agent's manifest. Tests run from the repo root.
// (ported from apps/editor/e2e/v29-workspace.spec.ts)
import { assert, assertEquals } from '@std/assert';
import { jsAdapter } from '@2d-platform/engine';
import { TILE } from './constants.ts';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(Deno.readTextFileSync(path));
}

Deno.test('v29 M4: root deno.json declares the packages/agent workspace member', () => {
  const cfg = readJson('deno.json');
  assert(Array.isArray(cfg.workspace));
  assert(cfg.workspace.includes('./packages/agent'));
});

Deno.test('v29 M4: packages/agent/deno.json is well-formed', () => {
  const cfg = readJson('packages/agent/deno.json');
  assertEquals(cfg.name, '@2d-platform/agent');
  assertEquals(cfg.exports, './src/index.ts');
});

Deno.test('v29 M4: agent local constants match the engine TILE', () => {
  // The agent owns its constants.ts (TILE=20) instead of importing the
  // engine's. Assert it equals the adapter's engine TILE — the same
  // value the assertAdapter() contract checks.
  assertEquals(TILE, 20);
  assertEquals(jsAdapter.TILE, 20);
});
