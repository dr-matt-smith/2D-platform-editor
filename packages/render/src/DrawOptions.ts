import type { CameraWindow } from './CameraWindow.ts';
import type { EntityState } from './EntityState.ts';

// Per-frame settings for `LevelRenderer.draw`. All optional: the editor
// preview passes none and gets a still picture of the whole level.
export interface DrawOptions {
  // Time in ms (e.g. `performance.now()`) for animated sprites. Omitted,
  // every animation shows frame 0.
  now?: number;
  // Draw only this part of the world, on a canvas sized to the view.
  // Omitted (or null), the canvas fits the whole level.
  camera?: CameraWindow | null;
  // Game state that swaps sprites (the locked exit). Omitted, every glyph
  // shows its normal sprite.
  entityState?: EntityState | null;
}
