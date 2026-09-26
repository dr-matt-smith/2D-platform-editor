import { Legend } from '@2d-platform/level-format';
import { Tileset } from '@2d-platform/render';

// A tileset and the glyph legend built from its tile_lookup.json.
export interface LoadedTileset {
  tileset: Tileset;
  legend: Legend;
}

// Loads a tileset by id. `Tileset.load` fits this type.
export type TilesetLoader = (id: string) => Promise<Tileset>;

// Tilesets by id, each loaded once. Most levels share a tileset, so
// switching between them never refetches the images.
export class TilesetCache {
  // Promises, not tilesets, so two requests for one id share a single load.
  private readonly loaded = new Map<string, Promise<LoadedTileset>>();

  constructor(private readonly loadTileset: TilesetLoader = (id) => Tileset.load(id)) {}

  // The tileset `id` and its legend, loading them the first time.
  get(id: string): Promise<LoadedTileset> {
    let loaded = this.loaded.get(id);
    if (!loaded) {
      // A missing tileset still resolves (with a null lookup), and
      // Legend.fromLookup then falls back to the default legend.
      loaded = this.loadTileset(id).then((tileset) => ({ tileset, legend: Legend.fromLookup(tileset.lookup) }));
      this.loaded.set(id, loaded);
    }
    return loaded;
  }
}
