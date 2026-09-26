// How a tileset's `images.<id>` entry is used. The values are the strings
// written in tile_lookup.json.
export enum ImageRole {
  // Stretched to fill the whole level, behind everything else.
  Background = 'background',
  // A free-placed overlay. Loaded but not yet placed by the renderer.
  Decoration = 'decoration',
}
