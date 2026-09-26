import type { SceneHost } from './SceneHost.ts';

// One screen of the game. The game calls `enter()` when the scene becomes
// active, `exit()` when it is replaced, and `update(dt)` then `draw(ctx)`
// every frame. `enter` and `exit` do nothing unless a subclass needs them;
// every scene must say how it updates and draws.
//
// A scene reaches the keyboard and sounds through `game`, typed as the
// `SceneHost` interface rather than the `Game` class so it can also run
// headless.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE.
export abstract class Scene {
  constructor(readonly game: SceneHost) {}

  enter(): void {}
  exit(): void {}
  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;
}
