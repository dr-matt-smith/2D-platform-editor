import { COLOURS, TILE } from './constants.ts';
import { Entity } from './Entity.ts';

// The level exit (a cell whose glyph has role `exit`). Touching it wins
// the level once the pickup rule is met. Not part of the vendored engine:
// the original platformer won as soon as every coin was collected.
export class Goal extends Entity {
  constructor(x: number, y: number) {
    super(x, y, TILE, TILE);
  }

  // A framed doorway in the accent colour, so it reads apart from coins
  // and spikes.
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLOURS.accent;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = COLOURS.bg;
    ctx.fillRect(
      this.x + this.w * 0.26,
      this.y + this.h * 0.28,
      this.w * 0.48,
      this.h * 0.72,
    );
    ctx.strokeStyle = COLOURS.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
  }
}
