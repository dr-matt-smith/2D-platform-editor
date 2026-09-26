# LegendEntry

`packages/level-format/src/LegendEntry.ts` · interface

One glyph's entry in a [Legend](Legend.md): its display name, its
[Role](Role.md), and how the editor shows it (an image, or a colour swatch).

## Relationships
- held by [Legend](Legend.md) (one per glyph)
- has a [Role](Role.md)
- built from a [GlyphDef](GlyphDef.md) by `Legend.fromLookup`

## Members
| Member | Kind | Description |
|---|---|---|
| `name` | readonly property | Display name (defaults to the glyph) |
| `role` | readonly property | The glyph's [Role](Role.md) |
| `image` | readonly property | Tileset-relative image path, or `null` |
| `color` | readonly property | CSS swatch colour, or `null` |

`LegendRecord`, in the same file, is a legend as a plain object:
`Readonly<Record<glyph, Pick<LegendEntry, 'role'> & Partial<LegendEntry>>>`
— the form `Legend.toRecord()` returns and `Legend.fromRecord()` accepts.

## Example
```ts
Legend.DEFAULT.get('P');
// { name: 'Player spawn', role: Role.Player, image: null, color: '#3498db' }
```

## Design notes
Unlike [GlyphDef](GlyphDef.md) (raw, all-optional JSON), every field here is
present and typed: the legend validates and normalises the data once, so
readers never deal with missing fields.
