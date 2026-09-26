# GridPosition

`packages/level-format/src/LevelData.ts` · interface

A cell of the grid, `{ col, row }`, both 0-based.

## Relationships
- returned by [Level](Level.md)`.findCells`
- used inside [LevelValidator](LevelValidator.md) to locate player spawns

## Members
| Member | Kind | Description |
|---|---|---|
| `col` | readonly property | 0-based column |
| `row` | readonly property | 0-based row |

## Example
```ts
Level.parse('P.o\no.E').findCells(Role.Pickup);   // [{ col: 2, row: 0 }, { col: 0, row: 1 }]
```

## Design notes
Naming the fields `col` / `row` (rather than `x` / `y`) keeps it clear that
these are cell indices, not pixel positions.
