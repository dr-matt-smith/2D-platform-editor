// v29 M1: physics-adapter contract. Asserts the `jsAdapter` shape the
// agent depends on — TILE plus the two factory methods that wrap
// PlaytestScene + ScriptedInput.
// (ported from apps/editor/e2e/v29-adapter.spec.ts)
import { assert, assertEquals } from '@std/assert';
import { parse, DEFAULT_LEGEND } from '@2d-platform/level-format';
import { jsAdapter } from './jsAdapter.ts';

Deno.test('v29 M1: jsAdapter exposes TILE + factory methods', () => {
  assertEquals(jsAdapter.TILE, 20);
  assertEquals(typeof jsAdapter.makeScene, 'function');
  assertEquals(typeof jsAdapter.makeScriptedInput, 'function');
});

Deno.test('v29 M1: makeScene returns a PlaytestScene-shaped handle', () => {
  const parsed = parse('#####\n#P.E#\n#####');
  const scene = jsAdapter.makeScene(parsed, DEFAULT_LEGEND, null);
  assertEquals(typeof scene.enter, 'function');
  assertEquals(typeof scene.update, 'function');
  assertEquals(typeof scene.setPlayerState, 'function');
  assert(scene.player != null);
  assert(Array.isArray(scene.coins));
  assertEquals(scene.phase, 'play');
  assert(scene.game != null && 'input' in scene.game);
});

Deno.test('v29 M1: makeScriptedInput returns an Input-shaped handle', () => {
  const si = jsAdapter.makeScriptedInput([]);
  assertEquals(typeof si.advance, 'function');
  assertEquals(typeof si.isDown, 'function');
  assertEquals(typeof si.wasPressed, 'function');
  assertEquals(typeof si.endFrame, 'function');
});
