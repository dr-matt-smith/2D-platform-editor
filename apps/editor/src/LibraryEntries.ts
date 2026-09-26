// The data shapes the level library reads and returns.

// One bundled level from content/data/levels/manifest.json.
export interface LevelManifestEntry {
  id: string;
  name: string;
  file: string;
  group?: string;
}

// One paste-loaded local level, stored in the `ld:v24:locals` list.
export interface LocalLevelEntry {
  id: string;
  name: string;
}

// One row of `LevelLibrary.list()`: a bundled level (with its file) or a
// local one (`file: null`, group 'local').
export interface LevelListItem {
  id: string;
  name: string;
  file: string | null;
  group?: string;
  // True when a saved draft differs from the bundled file.
  modified: boolean;
}

// One tileset from content/data/tilesets/manifest.json.
export interface TilesetManifestEntry {
  id: string;
  name: string;
}
