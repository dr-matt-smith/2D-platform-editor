# TilesetImageDef

`packages/render/src/TileLookup.ts` · interface

One `images.<id>` entry of `tile_lookup.json`: a whole image with a stable
id that a level can name in `# background-image:`.

## Relationships
- held by [TileLookup](TileLookup.md)`.images`, keyed by id
- `role` is matched against [ImageRole](ImageRole.md) by [Tileset](Tileset.md)`.load`

## Members
| Member | Kind | Description |
|---|---|---|
| `name` | optional property | Display name (the editor's picker) |
| `role` | optional property | `'background'` or `'decoration'` ([ImageRole](ImageRole.md)) |
| `image` | optional property | Path of the image |

## Example
```json
"bg-blue-clouds": { "name": "Blue clouds", "role": "background", "image": "tiles/Background.png" }
```

## Design notes
`role` is a plain `string` because this describes unvalidated JSON; the
[ImageRole](ImageRole.md) enum is what code compares it against.
