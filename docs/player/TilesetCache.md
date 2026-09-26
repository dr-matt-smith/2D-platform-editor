# TilesetCache

`apps/player/src/TilesetCache.ts` · class

Tilesets by id, each loaded once together with the glyph legend built from its `tile_lookup.json`. Most levels share a tileset, so switching between them never refetches the images.

## Relationships
- owned by [PlaySession](PlaySession.md)
- loads render's `Tileset`; builds level-format's `Legend`
- resolves to [LoadedTileset](LoadedTileset.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new TilesetCache(loadTileset?)` | constructor | How to load a tileset (a `TilesetLoader`); default `Tileset.load(id)` |
| `get(id)` | method | The tileset and its legend, loading them the first time. A missing tileset still resolves, with the default legend |

## Example
```ts
const cache = new TilesetCache();
const { tileset, legend } = await cache.get(level.meta.tileset);
```

## Design notes
- **Promises in the cache.** Storing the promise, not the result, means two
  requests for the same id during loading share one load.
- **Injected loader.** The `TilesetLoader` type (`(id) => Promise<Tileset>`)
  lets tests count loads and use fake I/O.
