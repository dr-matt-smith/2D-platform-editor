import { COLOURS, TILE } from './constants.ts';
import { Entity } from './Entity.ts';

// A pickup. The playtest collects it when the player overlaps it; a
// collected coin stays in the world's list (so the total stays fixed for
// the win rule) but is no longer drawn.
//
// `collected` is public and writable because the agent resets it when it
// rewinds a simulation.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE.
export class Coin extends Entity {
  collected = false;

  constructor(x: number, y: number) {
    super(x, y, TILE, TILE);
  }

  collect(): void {
    this.collected = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;
    ctx.fillStyle = COLOURS.accent;
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
