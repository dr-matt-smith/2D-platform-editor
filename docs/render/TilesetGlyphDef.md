# TilesetGlyphDef

`packages/render/src/TileLookup.ts` · interface

One `glyphs.<key>` entry of `tile_lookup.json`, with the fields that choose
its sprite.

## Relationships
- extends level-format's [GlyphDef](../level-format/GlyphDef.md) (`char`, `name`, `role`, `image`, `color`)
- held by [TileLookup](TileLookup.md)`.glyphs`
- its `frames` / `frame` / `fps` go to [SpriteStrip](SpriteStrip.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `imageLocked` | optional property | Drawn instead of `image` while the exit is locked ([EntityState](EntityState.md)) |
| `frames` | optional property | `image` is a horizontal strip of this many frames |
| `frame` | optional property | Always show this frame (no animation) |
| `fps` | optional property | Animation speed; `0` freezes on frame 0 |

## Example
```json
"exit": { "char": "E", "role": "exit", "image": "Flag.png", "imageLocked": "FlagOff.png", "frames": 10 }
```

## Design notes
Extends the level-format interface rather than copying it, so the fields
the legend reads are declared once.
