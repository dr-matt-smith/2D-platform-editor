import type { Sprite } from './Sprite.ts';

// The part of an image to draw into one cell: `image` cropped to the
// source rectangle (sx, sy, sw, sh). Sprite sheets use it to draw one
// frame of a strip; a plain image covers its whole area (`DrawSpec.whole`).
//
// A `DrawSpec` is also a `Sprite` that never changes over time.
export class DrawSpec implements Sprite {
  constructor(
    readonly image: HTMLImageElement,
    readonly sx: number,
    readonly sy: number,
    readonly sw: number,
    readonly sh: number,
  ) {}

  // The whole image as one frame.
  static whole(image: HTMLImageElement): DrawSpec {
    return new DrawSpec(image, 0, 0, image.width, image.height);
  }

  // A still sprite is the same at every moment.
  frameAt(_now?: number): DrawSpec {
    return this;
  }

  // Draw the source rectangle scaled into the `size`-px cell at (x, y).
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.drawImage(this.image, this.sx, this.sy, this.sw, this.sh, x, y, size, size);
  }
}
