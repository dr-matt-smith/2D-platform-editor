import { assertEquals } from '@std/assert';
import { Game } from './Game.ts';
import { Scene } from './Scene.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import { SoundBank } from './SoundBank.ts';
import type { SceneHost } from './SceneHost.ts';

Deno.test('Game.frameDt: a normal 60 fps frame is its elapsed time in seconds', () => {
  assertEquals(Game.frameDt(1016, 1000), 0.016);
});

Deno.test('Game.frameDt: long stalls are capped at 1/30 s so physics cannot tunnel', () => {
  assertEquals(Game.frameDt(5000, 1000), 1 / 30);
});

Deno.test('Game.frameDt: a timestamp earlier than the last one never runs physics backwards', () => {
  // The first requestAnimationFrame timestamp can precede the
  // performance.now() taken when the loop starts.
  assertEquals(Game.frameDt(995, 1000), 0);
});

// --- the scene lifecycle (no canvas drawing needed) -------------------

// A scene that records its lifecycle calls.
class RecordingScene extends Scene {
  readonly log: string[] = [];
  constructor(game: SceneHost, private readonly name: string) {
    super(game);
  }
  override enter(): void { this.log.push(`${this.name}:enter`); }
  override exit(): void { this.log.push(`${this.name}:exit`); }
  update(): void {}
  draw(): void {}
}

function fakeCanvas(): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => ({ imageSmoothingEnabled: true }) } as unknown as HTMLCanvasElement;
}

Deno.test('setScene exits the old scene and enters the new one', () => {
  const game = new Game<RecordingScene>({ canvas: fakeCanvas(), sounds: new SoundBank(), input: new ScriptedInput() });
  assertEquals(game.scene, null);
  const a = new RecordingScene(game, 'a');
  const b = new RecordingScene(game, 'b');
  game.setScene(a);
  game.setScene(b);
  assertEquals(a.log, ['a:enter', 'a:exit']);
  assertEquals(b.log, ['b:enter']);
  assertEquals(game.scene, b);
});

Deno.test('stop ends the loop', () => {
  const game = new Game({ canvas: fakeCanvas(), sounds: new SoundBank(), input: new ScriptedInput() });
  assertEquals(game.isRunning, false);
  game.stop();
  assertEquals(game.isRunning, false);
});
