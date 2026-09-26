import { TILE } from "../constants.ts";
import type { AssetLoader } from "../core/assets.ts";

/**
 * Pickup. A tile-sized AABB rendered as the coin sprite. PlaytestScene
 * sets `collected = true` on overlap; collected coins are skipped in
 * the draw loop so they vanish without being removed from the array
 * (cheaper than splicing and keeps the total count stable for the
 * win condition).
 */
export class Coin {
  declare x: number;
  declare y: number;
  declare w: number;
  declare h: number;
  declare collected: boolean;

  constructor(x: number, y: number) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
    this.collected = false;
  }

  draw(ctx: CanvasRenderingContext2D, assets: AssetLoader): void {
    ctx.drawImage(assets.sprite("coin"), this.x, this.y, this.w, this.h);
  }
}
