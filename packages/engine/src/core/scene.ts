/**
 * Base class for every screen of the game (title, gameplay, win, lose).
 * Subclasses override the four hooks below; all are no-ops by default
 * so a subclass only implements what it needs.
 *
 *   enter()   - one-shot setup when this scene becomes active
 *   exit()    - one-shot teardown when leaving this scene
 *   update(dt)- per-frame logic (input reads, physics, state changes)
 *   draw(ctx) - per-frame rendering onto the canvas 2D context
 *
 * Scenes receive the parent `Game` instance so they can read input,
 * play sounds, and call `game.setScene(...)` to transition.
 */
import type { Game } from "./game.ts";

export class Scene {
  declare game: Game;

  /** @param {Game} game */
  constructor(game: Game) { this.game = game; }
  enter(): void {}
  exit(): void {}
  // Overload signatures give subclasses the hook parameters; the base
  // no-op implementations take none.
  update(dt: number): void;
  update(/* dt */): void {}
  draw(ctx: CanvasRenderingContext2D): void;
  draw(/* ctx */): void {}
}
