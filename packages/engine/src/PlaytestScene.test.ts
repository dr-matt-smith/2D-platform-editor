import { assert, assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { GamePhase } from './GamePhase.ts';
import { Key } from './Key.ts';
import { PlaytestScene } from './PlaytestScene.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import { Sound } from './Sound.ts';
import type { RecordingEvent } from './RecordingEvent.ts';
import type { SceneHost } from './SceneHost.ts';

// `PlaytestScene.buildViewGrid` is pure — it returns a fresh array of
// rows with the chosen cells set to '.' and the others untouched. The
// static layer in `PlaytestScene.draw` uses it to hide the player's spawn
// glyph and collected coins from the editor renderer.

Deno.test('empty cleared list returns the same content (but a fresh array)', () => {
  const grid = ['#####', '#P.E#', '#####'];
  const out = PlaytestScene.buildViewGrid(grid, []);
  assertEquals(out, grid);
  // Fresh strings: no mutation of the original.
  out[1] = 'mutated';
  assertEquals(grid[1], '#P.E#');
});

Deno.test('player spawn cell is replaced with "."', () => {
  const grid = ['#####', '#P.E#', '#####'];
  const out = PlaytestScene.buildViewGrid(grid, [{ row: 1, col: 1 }]);
  assertEquals(out, ['#####', '#..E#', '#####']);
});

Deno.test('multiple collected-coin cells are replaced; uncollected stay', () => {
  const grid = ['##########', '#PooooE#..', '##########'];
  const out = PlaytestScene.buildViewGrid(grid, [
    { row: 1, col: 2 }, // first o collected
    { row: 1, col: 4 }, // third o collected
  ]);
  assertEquals(out[1], '#P.o.oE#..');
});

Deno.test('out-of-range cells are silently ignored, not thrown', () => {
  const grid = ['..', '..'];
  const out = PlaytestScene.buildViewGrid(grid, [
    { row: -1, col: 0 },     // negative row
    { row: 5, col: 0 },      // row past end
    { row: 0, col: 99 },     // col past end
    { row: 0, col: 0 },      // valid
  ]);
  assertEquals(out, ['..', '..']);
  // The only in-range cell that mattered was a '.' already, so the
  // grid looks identical; the test's point is the negative/oversize
  // entries didn't crash.
});

Deno.test('original grid is not mutated even when many cells are cleared', () => {
  const grid = ['oooo', 'oooo'];
  const out = PlaytestScene.buildViewGrid(grid, [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
  ]);
  assertEquals(out, ['....', '....']);
  assertEquals(grid, ['oooo', 'oooo']);
});

Deno.test('decoration glyphs are untouched (only listed cells change)', () => {
  // A decoration is just a char in the grid; buildViewGrid is glyph-
  // agnostic — it only changes cells you explicitly list.
  const grid = ['T.b.', '.P.E'];
  const out = PlaytestScene.buildViewGrid(grid, [{ row: 1, col: 1 }]);
  assertEquals(out, ['T.b.', '...E']);
});

// --- the scene itself, headless -----------------------------------------

// A scene on `text` with a silent host whose input replays `recording`,
// entered (restarted) and ready to update.
function sceneFor(text: string, recording: RecordingEvent[] = []): { scene: PlaytestScene; sounds: Sound[] } {
  const sounds: Sound[] = [];
  const host: SceneHost = { input: new ScriptedInput(recording), sounds: { play: (s) => sounds.push(s) } };
  const scene = new PlaytestScene(host, Level.parse(text), Legend.DEFAULT, null);
  scene.enter();
  return { scene, sounds };
}

// Step `scene` until its phase changes or `frames` run out.
function run(scene: PlaytestScene, frames: number): void {
  for (let f = 0; f < frames && scene.phase === GamePhase.Play; f++) scene.update(1 / 60);
}

const RIGHT: RecordingEvent = { frame: 0, key: Key.Right, down: true };

Deno.test('enter builds the world, settles the player and starts in Play', () => {
  const { scene } = sceneFor('#####\n#P.E#\n#...#\n#####');
  assertEquals(scene.phase, GamePhase.Play);
  assertEquals(scene.score, 0);
  // The spawn is one row above the floor: settled onto it.
  assertEquals([scene.player.y, scene.player.onGround], [40, true]);
  assertEquals([scene.simFrame, scene.simTime], [0, 0]);
});

Deno.test('walking into a pickup scores it and plays the coin sound', () => {
  const { scene, sounds } = sceneFor('#######\n#Po..E#\n#######', [RIGHT]);
  run(scene, 10);
  assertEquals(scene.score, 1);
  assertEquals(scene.total, 1);
  assert(scene.coins[0].collected);
  assertEquals(sounds, [Sound.Coin]);
});

Deno.test('reaching the exit with every pickup collected wins', () => {
  const { scene } = sceneFor('######\n#Po.E#\n######', [RIGHT]);
  run(scene, 120);
  assertEquals(scene.phase, GamePhase.Won);
});

Deno.test('the exit does not win until the pickup rule is met', () => {
  // The coin is behind the player, so it is never collected.
  const { scene } = sceneFor('######\n#oP.E#\n######', [RIGHT]);
  run(scene, 60);
  assertEquals(scene.phase, GamePhase.Play);
});

Deno.test('touching a hazard is game over', () => {
  const { scene } = sceneFor('######\n#P^.E#\n######', [RIGHT]);
  run(scene, 60);
  assertEquals(scene.phase, GamePhase.Dead);
});

Deno.test('falling out of the world is game over', () => {
  const { scene } = sceneFor('#P.E#\n#...#');
  run(scene, 120);
  assertEquals(scene.phase, GamePhase.Dead);
});

Deno.test('R restarts a finished game', () => {
  const { scene } = sceneFor('######\n#P^.E#\n######', [RIGHT]);
  run(scene, 60);
  assertEquals(scene.phase, GamePhase.Dead);
  // A keyboard-like source (no `advance`) with R just pressed.
  scene.game.input = {
    isDown: () => false,
    wasPressed: (key) => key === Key.R,
    endFrame() {},
    dispose() {},
  };
  scene.update(1 / 60);
  assertEquals(scene.phase, GamePhase.Play);
  assertEquals(scene.player.x, 20);
});

Deno.test('scripted input follows play time: frame = floor(simTime * 60)', () => {
  const { scene } = sceneFor('#####\n#P.E#\n#####');
  scene.update(1 / 30); // two recording frames' worth of time
  assertEquals(scene.simFrame, 2);
  assertEquals(scene.simTime, 1 / 30);
});

Deno.test('setPlayerState forces the player pose', () => {
  const { scene } = sceneFor('#####\n#P.E#\n#####');
  scene.setPlayerState({ x: 30, y: 5, vy: -100 });
  const p = scene.player;
  assertEquals([p.x, p.y, p.vx, p.vy, p.onGround], [30, 5, 0, -100, false]);
});
