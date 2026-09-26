import { TILE } from './constants.ts';
import { Game } from './Game.ts';
import { KeyboardInput } from './KeyboardInput.ts';
import { PlaytestGate } from './PlaytestGate.ts';
import { PlaytestScene } from './PlaytestScene.ts';
import { ScriptedInput } from './ScriptedInput.ts';
import { SoundBank } from './SoundBank.ts';
import { World } from './World.ts';
import type { Legend, LevelData } from '@2d-platform/level-format';
import type { RenderTileset } from '@2d-platform/render';
import type { GamePhase } from './GamePhase.ts';
import type { InputSource } from './InputSource.ts';
import type { LaunchOptions } from './LaunchOptions.ts';
import type { PlaytestLaunch } from './PlaytestLaunch.ts';

// A level being played on a canvas: the gate check, the canvas sizing, and
// the input, sounds, game loop and scene, wired together.
// `Playtest.launch(...)` starts one and returns it; the page that launched
// it owns the controls around the canvas (toolbar buttons, Esc) and calls
// `restart()` and `exit()` in response. The playtest itself never touches
// the page outside its canvas.
//
// Only one playtest runs at a time: launching while one is open does
// nothing, so a repeated Play shortcut cannot stack a second game loop and
// a second set of keyboard listeners.
export class Playtest {
  // True while a playtest is open. Shared by every launch, hence static.
  private static open = false;

  private readonly game: Game<PlaytestScene>;
  private readonly input: InputSource;
  private closed = false;
  private exitListener: (() => void) | null = null;

  private constructor(game: Game<PlaytestScene>, input: InputSource) {
    this.game = game;
    this.input = input;
  }

  // Launch `level` on `canvas`, unless the gate refuses it or a playtest
  // is already open (see `PlaytestLaunch`). The canvas is resized to the
  // level's `# viewport:`, or to the whole world when there is none; the
  // page repaints and resizes it again after `exit()`.
  //
  // Call it from a user-gesture handler (a click or key press): that is
  // when browsers let the sound system start.
  static launch(
    level: LevelData,
    legend: Legend,
    tileset: RenderTileset | null,
    canvas: HTMLCanvasElement,
    options: LaunchOptions = {},
  ): PlaytestLaunch {
    if (Playtest.open) return { ok: true, reasons: [], playtest: null };
    const gate = new PlaytestGate(legend).check(level);
    if (!gate.ok) return { ...gate, playtest: null };

    Playtest.sizeCanvas(canvas, level, legend);

    // Demo mode replays a recording; otherwise the keyboard drives. Both
    // are an `InputSource`, so nothing else needs to know which.
    const input: InputSource = Array.isArray(options.recording)
      ? new ScriptedInput(options.recording)
      : KeyboardInput.attach();
    const sounds = new SoundBank();
    sounds.prewarm();

    const game = new Game<PlaytestScene>({ canvas, sounds, input });
    const playtest = new Playtest(game, input);
    Playtest.open = true;
    game.setScene(new PlaytestScene(game, level, legend, tileset));
    game.start();
    return { ok: true, reasons: [], playtest };
  }

  // Whether a playtest is open right now.
  static get isOpen(): boolean {
    return Playtest.open;
  }

  // The scene's current phase.
  get phase(): GamePhase {
    return this.game.scene!.phase;
  }

  // True once `exit()` has been called.
  get isClosed(): boolean {
    return this.closed;
  }

  // Start the level again from the beginning.
  restart(): void {
    this.game.scene?.restart();
  }

  // Stop the game loop, release the keyboard, and call the `onExit`
  // listener. Only the first call does anything.
  exit(): void {
    if (this.closed) return;
    this.closed = true;
    Playtest.open = false;
    this.game.stop();
    this.input.dispose();
    if (this.exitListener) {
      const listener = this.exitListener;
      this.exitListener = null;
      listener();
    }
  }

  // Register a callback for when the playtest ends (fires once, from
  // `exit()`). A later call replaces the earlier callback.
  onExit(listener: () => void): void {
    this.exitListener = listener;
  }

  // Size the canvas to the viewport if the level sets one, otherwise to
  // the whole world.
  private static sizeCanvas(canvas: HTMLCanvasElement, level: LevelData, legend: Legend): void {
    const vp = level.meta?.viewport;
    if (vp) {
      canvas.width = vp.w * TILE;
      canvas.height = vp.h * TILE;
    } else {
      const world = World.fromLevel(level, legend);
      canvas.width = world.width;
      canvas.height = world.height;
    }
  }
}
