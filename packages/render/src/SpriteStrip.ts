import { DrawSpec } from './DrawSpec.ts';
import { SpriteAnimation } from './SpriteAnimation.ts';
import type { Sprite } from './Sprite.ts';

// An image holding `frames` equal frames side by side (a horizontal
// sprite strip). A glyph's `frames`, `frame` and `fps` fields in
// tile_lookup.json describe how to show it; `toSprite` turns that into a
// still `DrawSpec` or a `SpriteAnimation`.
export class SpriteStrip {
  // Animation speed for a strip whose glyph gives no `fps`.
  static readonly DEFAULT_FPS = 10;

  readonly frames: number;
  readonly frameWidth: number;

  // `frames` below 1 (or missing) means a single frame. A width that does
  // not divide evenly is allowed: the leftover pixels on the right are
  // never drawn, and a warning helps the tileset author spot it.
  constructor(readonly image: HTMLImageElement, frames: number | null = 1) {
    this.frames = Math.max(1, Math.floor(frames ?? 1));
    this.frameWidth = Math.floor(image.width / this.frames);
    if (this.frames > 1 && this.frames * this.frameWidth !== image.width) {
      console.warn(
        `tileset: frames:${this.frames} doesn't divide image width ${image.width}; right edge ignored`,
      );
    }
  }

  // Frame `index` of the strip (0-based, not range-checked).
  frame(index: number): DrawSpec {
    if (this.frames === 1) return DrawSpec.whole(this.image);
    return new DrawSpec(this.image, index * this.frameWidth, 0, this.frameWidth, this.image.height);
  }

  // Decide how the strip is shown, from the glyph's optional fields:
  //   - one frame                → the whole image;
  //   - `frame: i`               → frame i, still (out of range gives 0);
  //   - `fps: 0`                 → frame 0, still;
  //   - otherwise                → animated at `fps` (default 10).
  toSprite(frame: number | null = null, fps: number | null = null): Sprite {
    if (this.frames === 1) return this.frame(0);
    if (frame != null) {
      const index = Math.max(0, Math.floor(frame));
      return this.frame(index < this.frames ? index : 0);
    }
    const rate = Math.max(0, Math.floor(fps ?? SpriteStrip.DEFAULT_FPS));
    if (rate === 0) return this.frame(0);
    return new SpriteAnimation(this, rate);
  }
}
