import { TILE } from "../constants.js";

/**
 * Pickup. A tile-sized AABB rendered as the coin sprite. PlaytestScene
 * sets `collected = true` on overlap; collected coins are skipped in
 * the draw loop so they vanish without being removed from the array
 * (cheaper than splicing and keeps the total count stable for the
 * win condition).
 */
export class Coin {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
    this.collected = false;
  }

  draw(ctx, assets) {
    ctx.drawImage(assets.sprite("coin"), this.x, this.y, this.w, this.h);
  }
}
