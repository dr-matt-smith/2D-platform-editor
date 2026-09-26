import { TILE } from "../constants.ts";
import type { AssetLoader } from "../core/assets.ts";

/**
 * Lethal hazard. A tile-sized AABB rendered as the spike sprite.
 * Touching it ends the run — PlaytestScene shows GAME OVER on overlap.
 * AABB is intentionally generous compared to the triangular art.
 */
export class Spike {
  declare x: number;
  declare y: number;
  declare w: number;
  declare h: number;

  constructor(x: number, y: number) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
  }

  draw(ctx: CanvasRenderingContext2D, assets: AssetLoader): void {
    ctx.drawImage(assets.sprite("spike"), this.x, this.y, this.w, this.h);
  }
}
