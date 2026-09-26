# Point

`packages/agent/src/PlayerState.ts` · interface

A position in world pixels (the player's AABB top-left).

## Relationships
- `endPos` and `trajectory` points of [ActionResult](ActionResult.md); `pos` of [SimResult](SimResult.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | The position |

## Example
```ts
LevelGrid.cellAt(result.endPos);
```

## Design notes
A named shape instead of a bare `{ x, y }` makes signatures read clearly.
