// @2d-platform/render — loading tilesets (tile_lookup.json + images) and
// drawing a level onto a 2D canvas. Shared by the editor preview and the
// playtest engine so both paint pixel-identical frames.
export { BrowserImageLoader } from './BrowserImageLoader.ts';
export { CellRange } from './CellRange.ts';
export { DrawSpec } from './DrawSpec.ts';
export { FallbackShape } from './FallbackShape.ts';
export { FallbackStyle } from './FallbackStyle.ts';
export { ImageRole } from './ImageRole.ts';
export { LevelRenderer } from './LevelRenderer.ts';
export { Neighbour } from './Neighbour.ts';
export { Palette } from './Palette.ts';
export { SpriteAnimation } from './SpriteAnimation.ts';
export { SpriteStrip } from './SpriteStrip.ts';
export { TerrainMask } from './TerrainMask.ts';
export { Tileset } from './Tileset.ts';
export { TilesetDirectory } from './TilesetDirectory.ts';
export type { CameraWindow } from './CameraWindow.ts';
export type { DrawOptions } from './DrawOptions.ts';
export type { EntityState } from './EntityState.ts';
export type { RenderLevel } from './LevelRenderer.ts';
export type { RenderTileset } from './RenderTileset.ts';
export type { Sprite } from './Sprite.ts';
export type {
  TerrainDecl,
  TerrainMaskDef,
  TerrainMasks,
  TileLookup,
  TilesetGlyphDef,
  TilesetImageDef,
  TilesetImages,
} from './TileLookup.ts';
export type { ImageLoader, TilesetFetch, TilesetFetchResponse, TilesetIO } from './TilesetIO.ts';
