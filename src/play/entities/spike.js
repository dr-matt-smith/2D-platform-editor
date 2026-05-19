import { TILE } from "../constants.js";

/**
 * Lethal hazard. A tile-sized AABB rendered as the spike sprite.
 * Touching it ends the run — PlaytestScene shows GAME OVER on overlap.
 * AABB is intentionally generous compared to the triangular art.
 */
export class Spike {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
  }

  draw(ctx, assets) {
    ctx.drawImage(assets.sprite("spike"), this.x, this.y, this.w, this.h);
  }
}
