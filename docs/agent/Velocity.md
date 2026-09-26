# Velocity

`packages/agent/src/PlayerState.ts` · interface

A velocity in pixels per second.

## Relationships
- `endVel` of [ActionResult](ActionResult.md), [NavEdge](NavEdge.md) and [PerFrameEdge](PerFrameEdge.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `vx`, `vy` | properties | Horizontal and vertical speed |

## Example
```ts
if (result.endVel.vy === 0) console.log('landed');
```

## Design notes
Kept separate from [Point](Point.md) so a position can't be passed where a speed is meant.
