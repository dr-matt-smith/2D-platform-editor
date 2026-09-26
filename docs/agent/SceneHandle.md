# SceneHandle

`packages/agent/src/SceneHandle.ts` · interface

The surface of the engine's playtest scene the agent uses: read the player and the phase, force the player's state, and step physics. The same file defines `ScenePhase`.

## Relationships
- made by [PhysicsAdapter](PhysicsAdapter.md)`.makeScene` (the engine returns its `PlaytestScene`)
- has a [SceneGame](SceneGame.md) and a [PlayerBody](PlayerBody.md); `setPlayerState` takes a [PlayerState](PlayerState.md)
- driven by [ActionSimulator](ActionSimulator.md) and [Simulator](Simulator.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `game` | property | The [SceneGame](SceneGame.md) whose `input` the agent swaps |
| `player` | property | The live [PlayerBody](PlayerBody.md) |
| `coins` | property | Pickups, each with a writable `collected` flag |
| `phase` | property | `ScenePhase`: `'play'`, `'won'` or `'dead'` |
| `score` | property | Pickups collected |
| `simFrame`, `simTime` | properties | The scripted-input frame counter and the clock (reset between simulations) |
| `enter()` | method | Build the entities; phase becomes `'play'` |
| `update(dt)` | method | Step physics one tick |
| `setPlayerState(state)` | method | Force the player's exact state |

## Example
```ts
const scene = adapter.makeScene(level, legend, null);
scene.setPlayerState({ x: 20, y: 40, vx: 0, vy: 0, onGround: true });
scene.update(1 / 60);
if (scene.phase === 'won') console.log('won with', scene.score);
```

## Design notes
- **An interface, not the engine's class.** It lists only what the agent
  touches, so the engine's richer `PlaytestScene` satisfies it
  structurally — no `implements` clause needed on the engine side.
- **`ScenePhase` is a union, not an enum.** The engine's `GamePhase` enum
  has the same three values. TypeScript lets a string enum member stand in
  for its matching string literal, but not for a *different* enum, so a
  union keeps the engine's scene assignable to this interface.
- **Writable fields by design.** The agent resets phase, score, coins and
  clocks to reuse one scene for thousands of simulations.
