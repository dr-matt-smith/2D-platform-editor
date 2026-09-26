import { FallbackShape } from './FallbackShape.ts';

// How to draw a glyph without an image: a colour and a shape. Used when a
// tileset has no sprite for a glyph (the Dirt tileset draws its player,
// hazard, pickup and exit this way) or no tileset loaded at all.
export class FallbackStyle {
  constructor(readonly color: string, readonly shape: FallbackShape) {}

  // Draw the shape into the `size`-px cell at (x, y).
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = this.color;
    switch (this.shape) {
      case FallbackShape.Block:
        ctx.fillRect(x, y, size, size);
        break;
      case FallbackShape.Spike:
        ctx.beginPath();
        ctx.moveTo(x, y + size);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x + size, y + size);
        ctx.closePath();
        ctx.fill();
        break;
      case FallbackShape.Disc:
      case FallbackShape.Pip: {
        const radius = this.shape === FallbackShape.Disc ? size * 0.4 : size * 0.18;
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}
