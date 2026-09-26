# LoadedTileset

`apps/editor/src/ActiveTileset.ts` · interface

One loaded tileset and what the editor derives from it; the value
[ActiveTileset](ActiveTileset.md) caches per id.

## Relationships
- produced and cached by [ActiveTileset](ActiveTileset.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `tileset` | property | render's `Tileset` |
| `legend` | property | Its level-format `Legend` (`Legend.DEFAULT` if the lookup failed) |
| `base` | property | Folder URL for thumbnails (Dirt's, with the default legend) |
| `ok` | property | Whether the tileset's lookup loaded |

## Example
```ts
const loaded: LoadedTileset = { tileset, legend: Legend.fromLookup(tileset.lookup), base, ok: true };
```

## Design notes
A plain data shape: the four facts are computed together once and never change.
