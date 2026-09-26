# LoadedTileset

`apps/player/src/TilesetCache.ts` · interface

A tileset together with the glyph legend built from its lookup.

## Relationships
- resolved by [TilesetCache](TilesetCache.md)`.get()`; used by [PlaySession](PlaySession.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `tileset` | property | render's `Tileset` |
| `legend` | property | level-format's `Legend` (`Legend.DEFAULT` if the tileset has no lookup) |

## Example
```ts
const { tileset, legend } = await tilesets.get(id);
```

## Design notes
The pair always travels together, so it is one value.
