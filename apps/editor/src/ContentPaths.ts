// URLs of the game content (levels and tilesets) the editor fetches.
//
// `BASE` is Vite's deploy base: '/' in development and on a root deploy,
// '/2D-platform-editor/' on GitHub Pages. Outside Vite (`deno test`)
// `import.meta.env` is undefined, so the fallback keeps URLs rooted at '/'.
export class ContentPaths {
  static readonly BASE: string = import.meta.env?.BASE_URL ?? '/';

  static readonly LEVELS_MANIFEST = `${ContentPaths.BASE}data/levels/manifest.json`;
  static readonly TILESETS_MANIFEST = `${ContentPaths.BASE}data/tilesets/manifest.json`;

  // A bundled level file, e.g. `level('tutorial.txt')`.
  static level(file: string): string {
    return `${ContentPaths.BASE}data/levels/${file}`;
  }

  // A tileset's folder, with a trailing slash (legend thumbnails resolve
  // their image paths against it).
  static tilesetFolder(id: string): string {
    return `${ContentPaths.BASE}data/tilesets/${id}/`;
  }
}
