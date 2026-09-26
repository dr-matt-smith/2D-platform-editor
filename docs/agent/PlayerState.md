# PlayerState

`packages/agent/src/PlayerState.ts` · interface

The player's exact continuous-physics state: AABB top-left, velocity and whether it is standing on something.

## Relationships
- the shape of [SceneHandle](SceneHandle.md)`.setPlayerState`; extended by [PlayerBody](PlayerBody.md)
- the per-frame planner's search state; clustered by [StateCluster](StateCluster.md); bucketed by [StateKey](StateKey.md)`.ofState`
- `endState` of [ActionResult](ActionResult.md), [NavEdge](NavEdge.md) and [PerFrameEdge](PerFrameEdge.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | AABB top-left, world px |
| `vx`, `vy` | properties | Velocity, px/s |
| `onGround` | property | Standing on something? |

## Example
```ts
simulator.simulate({ x: 20, y: 40, vx: 0, vy: 0, onGround: true }, new WalkAction(Direction.Right, 1));
```

## Design notes
Exactly what the engine's `setPlayerState` takes, so one simulation can resume precisely where another stopped. That is what makes a per-frame plan exact.
