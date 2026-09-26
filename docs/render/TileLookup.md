# TileLookup

`packages/render/src/TileLookup.ts` · interface

The whole of a tileset's `tile_lookup.json`, as [Tileset](Tileset.md)`.load`
reads it. It extends level-format's `GlyphLookup` (the part the legend reads)
with the image, animation and terrain fields only the renderer needs.

## Relationships
- extends level-format's [GlyphLookup](../level-format/GlyphLookup.md)
- holds [TilesetGlyphDef](TilesetGlyphDef.md)s, a [TerrainDecl](TerrainDecl.md) and [TilesetImageDef](TilesetImageDef.md)s
- read by [TilesetDirectory](TilesetDirectory.md)`.lookup`; kept as [Tileset](Tileset.md)`.lookup` (the editor reads its `images` for the background-image picker)

## Members
| Member | Kind | Description |
|---|---|---|
| `glyphs` | optional property | `Record<key, TilesetGlyphDef>` — `player`, `filled`, `apple`, … |
| `terrain` | optional property | [TerrainDecl](TerrainDecl.md) — autotile images |
| `filled` | optional property | `TerrainMasks` — legacy name for `terrain.masks` (the Dirt tileset) |
| `images` | optional property | `TilesetImages` — id → [TilesetImageDef](TilesetImageDef.md) |

Two type aliases live beside it: `TerrainMasks` (mask `'0'`–`'15'` →
[TerrainMaskDef](TerrainMaskDef.md)) and `TilesetImages` (id →
[TilesetImageDef](TilesetImageDef.md)).

## Example
```json
{
  "glyphs": {
    "filled": { "char": "#", "image": "tiles/Block.png" },
    "player": { "char": "P", "role": "player", "image": "Idle.png", "frames": 11 }
  },
  "terrain": { "default": { "image": "tiles/Block.png" } },
  "images": { "bg-blue": { "role": "background", "image": "tiles/Background.png" } }
}
```

## Design notes
- **Interface inheritance across packages.** level-format declares only the
  fields it reads; this package extends that interface with its own, so
  neither package has to know the other's fields.
- It describes *unvalidated JSON*, so every field is optional and may be
  `null`; the [Tileset](Tileset.md) turns it into something reliable.
