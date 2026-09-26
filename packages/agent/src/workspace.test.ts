// Workspace scaffolding: the root deno.json declares the packages/agent
// workspace member, and packages/agent/deno.json is the agent's
// manifest. Tests run from the repo root.
import { assert, assertEquals } from '@std/assert';
import { jsAdapter } from '@2d-platform/engine';
import { TILE } from './constants.ts';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(Deno.readTextFileSync(path));
}

Deno.test('root deno.json declares the packages/agent workspace member', () => {
  const cfg = readJson('deno.json');
  assert(Array.isArray(cfg.workspace));
  assert(cfg.workspace.includes('./packages/agent'));
});

Deno.test('packages/agent/deno.json is well-formed', () => {
  const cfg = readJson('packages/agent/deno.json');
  assertEquals(cfg.name, '@2d-platform/agent');
  assertEquals(cfg.exports, './src/index.ts');
});

Deno.test('agent local constants match the engine TILE', () => {
  // The agent owns its constants.ts (TILE=20) instead of importing the
  // engine's. Assert it equals the adapter's engine TILE — the same
  // value AdapterGuard checks.
  assertEquals(TILE, 20);
  assertEquals(jsAdapter.TILE, 20);
});
