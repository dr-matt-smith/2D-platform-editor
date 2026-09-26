# ActionResult

`packages/agent/src/ActionResult.ts` · interface

Where one simulated action left the player.

## Relationships
- returned by [ActionSimulator](ActionSimulator.md)`.simulate`; `outcome` is an [ActionOutcome](ActionOutcome.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `outcome` | property | How it ended |
| `endPos` | property | AABB top-left ([Point](Point.md)) |
| `endCell` | property | The cell containing the AABB centre |
| `endVel` | property | [Velocity](Velocity.md) |
| `endState` | property | The exact [PlayerState](PlayerState.md) |
| `trajectory` | property | Position after every frame, or null unless asked for |
| `collided` | property | Pushed against a wall? |
| `cost` | property | Frames the action took |

## Example
```ts
const r = simulator.simulate(state, action);
if (r.outcome === ActionOutcome.Ok && !r.collided) useEdge(r.endCell, r.cost);
```

## Design notes
Plain result data; `endState` lets the next simulation start exactly here.
