# Cell

`packages/agent/src/Cell.ts` · interface

A grid cell: row `r`, column `c`.

## Relationships
- extended by [NavNode](NavNode.md) and [UnreachableGoal](UnreachableGoal.md)
- the text form is [CellKey](CellKey.md); returned by [LevelGrid](LevelGrid.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `r` | property | Row |
| `c` | property | Column |

## Example
```ts
const exit: Cell = { r: 3, c: 9 };
```

## Design notes
Plain data rather than a class, so `{ r, c }` literals work everywhere and it serialises as-is.
