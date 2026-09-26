import type { DrawSpec } from './DrawSpec.ts';
import type { EntityState } from './EntityState.ts';

// What `LevelRenderer` needs from a tileset. `Tileset` implements it;
// tests and the engine can pass anything of this shape.
//
// Only the atlas members are required. Each sprite method is optional,
// and a missing method is treated like one that always answers null (so
// the renderer draws the fallback shape).
export interface RenderTileset {
  // Whether `drawTile` can be used; the sky and decor passes need it.
  readonly atlasReady: boolean;
  drawTile(ctx: CanvasRenderingContext2D, index: number, dx: number, dy: number, size: number): void;
  terrainFor?(mask: number, now?: number): DrawSpec | null;
  entityFor?(char: string, now?: number, state?: EntityState | null): DrawSpec | null;
  decorationFor?(char: string, now?: number): DrawSpec | null;
  foregroundFor?(char: string, now?: number): DrawSpec | null;
  backgroundImage?(id: string): HTMLImageElement | null;
}
