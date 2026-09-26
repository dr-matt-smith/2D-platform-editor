import { Aabb } from './Aabb.ts';
import type { Box } from './Box.ts';
import type { Point } from './Point.ts';
import type { UpdateContext } from './UpdateContext.ts';

// Anything that exists in the game world: an axis-aligned box that can
// update itself each frame and draw itself. The world holds one subclass
// per kind of thing — `Player`, `Platform`, `Coin`, `Spike`, `Goal` — and
// code that only needs "an entity" (collision, drawing a list) treats
// them all alike.
//
// `x` and `y` are public and writable because the agent's physics
// contract reads and sets the player's position directly.
//
// The base class is new; the box fields it holds were repeated in each of
// simple-platformer-1's entity classes (CC BY 4.0) — see ../LICENSE.
export abstract class Entity implements Box {
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;

  protected constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  // A snapshot of the entity's box, safe to keep or change.
  get bounds(): Box {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // The centre of the box.
  get centre(): Point {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  // True when this entity's box overlaps `other`'s.
  overlaps(other: Box): boolean {
    return Aabb.overlaps(this, other);
  }

  // Advance one frame. Most entities never move, so the default does
  // nothing; `Player` overrides it with its physics.
  update(_dt: number, _context: UpdateContext): void {}

  // Draw the entity as a simple shape at its world position. The
  // playtest draws through the shared `LevelRenderer` instead (so play
  // matches the editor preview); this is the engine's own tileset-free
  // view, used by `World.draw`.
  abstract draw(ctx: CanvasRenderingContext2D): void;
}
