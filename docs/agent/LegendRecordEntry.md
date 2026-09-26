# LegendRecordEntry

`packages/agent/src/LegendRecord.ts` · interface

One glyph's legend entry; the agent reads only its `role`.

## Relationships
- the values of a [LegendRecord](LegendRecord.md); roles compared against [GlyphRole](GlyphRole.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `role?` | property | The glyph's role string, e.g. `'terrain'` |

## Example
```ts
LevelGrid.glyphRole({ '#': { role: 'terrain' } }, '#'); // 'terrain'
```

## Design notes
Only the field the agent reads is declared, so richer entries (with images, names, …) still fit.
