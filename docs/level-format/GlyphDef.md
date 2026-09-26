# GlyphDef

`packages/level-format/src/GlyphLookup.ts` · interface

One raw glyph entry from a `tile_lookup.json` `glyphs` section, as loaded
from disk.

## Relationships
- held by [GlyphLookup](GlyphLookup.md)
- turned into a [LegendEntry](LegendEntry.md) by [Legend](Legend.md)`.fromLookup`
- extended by the render package's `TilesetGlyphDef` (frames, fps, locked image)

## Members
| Member | Kind | Description |
|---|---|---|
| `char` | optional property | The glyph character; entries without one are skipped |
| `name` | optional property | Display name |
| `role` | optional property | Declared role — a [Role](Role.md) value, or a legacy name such as `'entity'` |
| `image` | optional property | Tileset-relative image path |
| `color` | optional property | Swatch colour |

## Example
```json
"hazard": { "char": "^", "name": "Spikes", "role": "terrain", "image": "tiles/spikes.png" }
```
This legacy entry declares `terrain`, but its key `hazard` wins, so the
legend gives `^` the role `Role.Hazard`.

## Design notes
`role` is a plain `string`, not a `Role`, because the file may contain
anything. [Legend](Legend.md) resolves it with `isKnownRole`, falling back
to `Role.Unknown`.
