# TerrainMaskDef

`packages/render/src/TileLookup.ts` · interface

One terrain image entry: `terrain.masks[m]`, `terrain.default`, or the
legacy `filled[m]`.

## Relationships
- held by [TerrainDecl](TerrainDecl.md) and [TileLookup](TileLookup.md)`.filled`

## Members
| Member | Kind | Description |
|---|---|---|
| `image` | optional property | Path of the image, relative to the tileset folder |

## Example
```json
{ "image": "tiles/00_dirt_top_left.png" }
```

## Design notes
An object rather than a bare path, as in the file format, so an entry can
gain fields later without changing its shape.
