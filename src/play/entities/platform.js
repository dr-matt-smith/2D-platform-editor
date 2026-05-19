import { COLOURS } from "../constants.js";

/**
 * Solid rectangle the player collides against. Two visual variants
 * differentiated by `kind`:
 *   - "ground"   : full-tile dark block at the bottom of the level
 *   - "platform" : thinner mid-tile block with an outline, for jumping on
 *
 * Both behave identically for collision — the distinction is purely
 * cosmetic so the player can read the level layout at a glance.
 */
export class Platform {
  constructor(x, y, w, h, kind = "platform") {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.kind = kind;
  }

  draw(ctx) {
    ctx.fillStyle = this.kind === "ground" ? COLOURS.ground : COLOURS.platform;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    if (this.kind === "platform") {
      ctx.strokeStyle = COLOURS.platformLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
    }
  }
}
