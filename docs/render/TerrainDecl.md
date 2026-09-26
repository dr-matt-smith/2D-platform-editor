# TerrainDecl

`packages/render/src/TileLookup.ts` · interface

The `terrain` block of `tile_lookup.json`: terrain images per
[TerrainMask](TerrainMask.md) value, and a single image for tilesets that
ship no edge variants.

## Relationships
- the `terrain` of a [TileLookup](TileLookup.md)
- holds [TerrainMaskDef](TerrainMaskDef.md)s
- read by [Tileset](Tileset.md)`.load`

## Members
| Member | Kind | Description |
|---|---|---|
| `masks` | optional property | `TerrainMasks` — `'0'`–`'15'` → [TerrainMaskDef](TerrainMaskDef.md) |
| `default` | optional property | [TerrainMaskDef](TerrainMaskDef.md) used for any mask without its own image |

## Example
```json
"terrain": { "masks": { "15": { "image": "tiles/centre.png" } }, "default": { "image": "tiles/Block.png" } }
```

## Design notes
Terrain resolves in order: the mask's image, then `default`, then the `#`
glyph's own image — so a tileset can be as simple as one block picture.
