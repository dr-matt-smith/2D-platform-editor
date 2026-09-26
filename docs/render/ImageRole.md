# ImageRole

`packages/render/src/ImageRole.ts` · enum

How an `images.<id>` entry of `tile_lookup.json` is used. The values are the
strings written in the file.

## Relationships
- matched against [TilesetImageDef](TilesetImageDef.md)`.role` by [Tileset](Tileset.md)`.load`
- decides between [Tileset](Tileset.md)`.backgroundImage` and `.decorationImage`

## Members
| Member | Kind | Description |
|---|---|---|
| `Background` = `'background'` | enum member | Stretched over the whole level, behind everything; chosen by `# background-image:` |
| `Decoration` = `'decoration'` | enum member | A free-placed overlay; loaded but not yet placed by the renderer |

## Example
```ts
if (def.role === ImageRole.Background) backgrounds.set(id, image);
```

## Design notes
A string enum matching the data, so tilesets did not change.
[TilesetImageDef](TilesetImageDef.md)`.role` stays a plain `string` because
it describes unvalidated JSON; an unknown role is simply ignored.
