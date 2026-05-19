import { TILE, COLOURS } from "../constants.js";

/**
 * The level Exit — designer glyph `E`. v9-ORIGINAL entity: the imported
 * platformer has no exit (it won on all-coins-collected). A tile-sized
 * AABB drawn as a shape (the designer ships no exit sprite): a framed
 * doorway in the accent colour, so it reads distinctly from coins/spikes.
 *
 * PlaytestScene wins when every pickup is collected AND the player
 * overlaps a Goal (TDD v9 design §4.1 / §6).
 */
export class Goal {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
  }

  draw(ctx) {
    // Accent frame …
    ctx.fillStyle = COLOURS.accent;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // … with a dark doorway cut into it.
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
