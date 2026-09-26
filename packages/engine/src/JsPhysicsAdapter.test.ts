// v29 M1: physics-adapter contract. Asserts the `jsAdapter` shape the
// agent depends on — TILE plus the two factory methods that wrap
// PlaytestScene + ScriptedInput.
// (ported from apps/editor/e2e/v29-adapter.spec.ts)
import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { JsPhysicsAdapter, jsAdapter } from './JsPhysicsAdapter.ts';
import { PlaytestScene } from './PlaytestScene.ts';
import { ScriptedInput } from './ScriptedInput.ts';

Deno.test('v29 M1: jsAdapter exposes TILE + factory methods', () => {
  assertEquals(jsAdapter.TILE, 20);
  assertEquals(typeof jsAdapter.makeScene, 'function');
  assertEquals(typeof jsAdapter.makeScriptedInput, 'function');
});

Deno.test('v29 M1: makeScene returns a PlaytestScene-shaped handle', () => {
  const parsed = Level.parse('#####\n#P.E#\n#####');
  const scene = jsAdapter.makeScene(parsed, Legend.DEFAULT.toRecord(), null);
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

Deno.test('jsAdapter is a JsPhysicsAdapter; makeScene / makeScriptedInput build the engine classes', () => {
  assert(jsAdapter instanceof JsPhysicsAdapter);
  const scene = jsAdapter.makeScene(Level.parse('#####\n#P.E#\n#####'), Legend.DEFAULT.toRecord());
  assert(scene instanceof PlaytestScene);
  assert(jsAdapter.makeScriptedInput() instanceof ScriptedInput);
});

Deno.test('makeScene: the player is built from the legend record and settled', () => {
  const scene = jsAdapter.makeScene(Level.parse('#####\n#P.E#\n#####'), Legend.DEFAULT.toRecord());
  // P at column 1, row 1 of 20-px tiles, settled onto the floor below.
  assertEquals(
    { x: scene.player.x, y: scene.player.y, onGround: scene.player.onGround },
    { x: 20, y: 20, onGround: true },
  );
});

Deno.test('makeScene: steps headless with a swapped-in input', () => {
  // A coin right of the spawn: the silent headless host takes the pickup sound.
  const scene = jsAdapter.makeScene(Level.parse('######\n#Po.E#\n######'), Legend.DEFAULT.toRecord());
  const input = jsAdapter.makeScriptedInput([{ frame: 0, key: 'right', down: true }]);
  scene.game.input = input;
  for (let f = 0; f < 30 && scene.score === 0; f++) {
    input.advance(f);
    scene.update(1 / 60);
  }
  assertEquals(scene.score, 1);
});
