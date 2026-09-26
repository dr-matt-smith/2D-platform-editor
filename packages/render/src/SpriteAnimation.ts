import type { DrawSpec } from './DrawSpec.ts';
import type { Sprite } from './Sprite.ts';
import type { SpriteStrip } from './SpriteStrip.ts';

// A sprite strip played on a loop at `fps` frames per second. It holds no
// clock of its own: the frame is worked out from the `now` passed in, so
// every caller asking about the same moment sees the same frame and tests
// can ask about any moment.
export class SpriteAnimation implements Sprite {
  constructor(readonly strip: SpriteStrip, readonly fps: number) {}

  frameAt(now?: number): DrawSpec {
    // NaN or a negative time would give a negative frame, so treat both
    // (and a missing time) as time 0.
    const t = now !== undefined && Number.isFinite(now) && now > 0 ? now : 0;
    const index = Math.floor((t * this.fps) / 1000) % this.strip.frames;
    return this.strip.frame(index);
  }
}
