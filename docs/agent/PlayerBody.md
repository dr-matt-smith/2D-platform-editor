# PlayerBody

`packages/agent/src/PlayerState.ts` · interface

A [PlayerState](PlayerState.md) plus the player's AABB size: the live player of a scene.

## Relationships
- extends [PlayerState](PlayerState.md); read from [SceneHandle](SceneHandle.md)`.player`

## Members
| Member | Kind | Description |
|---|---|---|
| `w`, `h` | properties | AABB size, px |
| (inherited) |  | `x`, `y`, `vx`, `vy`, `onGround` |

## Example
```ts
const centreY = scene.player.y + scene.player.h / 2;
```

## Design notes
Interface inheritance: a body *is* a state with a size, so it extends rather than repeats it.
