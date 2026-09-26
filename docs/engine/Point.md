# Point

`packages/engine/src/Point.ts` · interface

A position in world pixels.

## Relationships
- returned by [Entity](Entity.md)`.centre`
- taken by [PlaytestCamera](PlaytestCamera.md)`.centreOn` / `.follow`

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | The position |

## Example
```ts
camera.follow(player.centre);
```

## Design notes
A named shape instead of a bare `{ x, y }` makes signatures read clearly.
