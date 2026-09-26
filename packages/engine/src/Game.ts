import type { InputSource } from './InputSource.ts';
import type { Scene } from './Scene.ts';
import type { SceneHost } from './SceneHost.ts';
import type { SoundBank } from './SoundBank.ts';

// What `new Game(...)` needs.
export interface GameOptions {
  canvas: HTMLCanvasElement;
  sounds: SoundBank;
  input: InputSource;
}

// The game loop. Owns the canvas, the input and the sounds, holds the
// active scene, and runs a requestAnimationFrame loop that updates, clears
// and draws the scene each frame.
//
// `S` is the scene type it hosts, so the caller can read a subclass's
// members off `game.scene`.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE. Added
// here: `stop()`, so a playtest can end; the canvas is cleared at its
// real size (levels vary in size); and `frameDt` never goes negative.
export class Game<S extends Scene = Scene> implements SceneHost {
  // Longest time step simulated in one frame, so a stall (e.g. a hidden
  // tab) cannot make the player tunnel through platforms.
  static readonly MAX_DT = 1 / 30;

  input: InputSource;
  readonly sounds: SoundBank;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private current: S | null = null;
  private running = false;

  constructor({ canvas, sounds, input }: GameOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.sounds = sounds;
    this.input = input;
  }

  // Seconds of physics to simulate for one animation frame: the time
  // since the last frame, at most `MAX_DT` and never negative. The first
  // animation-frame timestamp can be earlier than the `performance.now()`
  // read in `start()`, and even a few milliseconds of negative time step
  // pushes the player through the floor.
  static frameDt(now: number, last: number): number {
    return Math.min(Math.max((now - last) / 1000, 0), Game.MAX_DT);
  }

  // The active scene, or null before the first `setScene`.
  get scene(): S | null {
    return this.current;
  }

  get isRunning(): boolean {
    return this.running;
  }

  // Swap the active scene: `exit()` the old one, `enter()` the new one.
  // Safe to call from inside a scene's update — the loop reads the scene
  // afresh each frame.
  setScene(scene: S): void {
    if (this.current) this.current.exit();
    this.current = scene;
    this.current.enter();
  }

  // Start the loop. Each frame: update the scene by `frameDt` seconds,
  // clear the canvas, draw the scene, then end the input frame.
  start(): void {
    this.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Game.frameDt(now, last);
      last = now;
      this.current!.update(dt);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.current!.draw(this.ctx);
      this.input.endFrame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // End the loop after the current frame.
  stop(): void {
    this.running = false;
  }
}
