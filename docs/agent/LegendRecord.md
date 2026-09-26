# LegendRecord

`packages/agent/src/LegendRecord.ts` · type alias

A glyph legend as a plain record, glyph → [LegendRecordEntry](LegendRecordEntry.md) — what level-format's `Legend.toRecord()` returns.

## Relationships
- read by [LevelGrid](LevelGrid.md); passed on to [PhysicsAdapter](PhysicsAdapter.md)`.makeScene`
- `null` means "the classic glyphs" (`#`, `^`, `P`, `E`, `o`)

## Members
| Member | Kind | Description |
|---|---|---|
| `[glyph]` | index signature | The glyph's [LegendRecordEntry](LegendRecordEntry.md), or undefined |

## Example
```ts
const legend: LegendRecord = { '=': { role: 'terrain' }, '@': { role: 'player' }, X: { role: 'exit' } };
```

## Design notes
The agent takes the record, not level-format's `Legend` class, because it may not import level-format. A plain record is also what crosses to the Python port.
