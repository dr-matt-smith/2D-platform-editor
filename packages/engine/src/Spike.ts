import { COLOURS, TILE } from './constants.ts';
import { Entity } from './Entity.ts';

// A lethal hazard: touching it ends the run. Its box is the whole tile,
// deliberately more generous than the triangle it is drawn as.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE.
export class Spike extends Entity {
  constructor(x: number, y: number) {
    super(x, y, TILE, TILE);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLOURS.text;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.h);
    ctx.lineTo(this.x + this.w / 2, this.y);
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.closePath();
    ctx.fill();
  }
}
