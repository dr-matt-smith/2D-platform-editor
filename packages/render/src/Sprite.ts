import type { DrawSpec } from './DrawSpec.ts';

// Something that can say what to draw at a given moment. A still image
// (`DrawSpec`) ignores the time; an animation (`SpriteAnimation`) picks a
// frame from it. The tileset stores every glyph as a `Sprite`, so it never
// needs to know which kind it holds.
export interface Sprite {
  // The frame to draw at `now` (ms, e.g. `performance.now()`). Omitting
  // `now` gives frame 0, which keeps the editor preview still.
  frameAt(now?: number): DrawSpec;
}
