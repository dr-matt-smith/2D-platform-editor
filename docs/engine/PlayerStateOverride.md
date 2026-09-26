# PlayerStateOverride

`packages/engine/src/Player.ts` · interface

A pose to force the player into.

## Relationships
- taken by [Player](Player.md)`.setState` and [PlaytestScene](PlaytestScene.md)`.setPlayerState`
- the agent's `PlayerState` (all fields required) fits it

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | Position (required) |
| `vx?`, `vy?` | properties | Velocity, default `0` |
| `onGround?` | property | Default `false` |

## Example
```ts
scene.setPlayerState({ x: 40, y: 20, onGround: true });
```

## Design notes
Optional fields with defaults mean a caller states only what it cares about.
