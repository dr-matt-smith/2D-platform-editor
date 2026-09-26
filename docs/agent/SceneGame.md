# SceneGame

`packages/agent/src/SceneHandle.ts` · interface

A scene's game object, as the agent sees it: something whose `input` can be swapped.

## Relationships
- held by [SceneHandle](SceneHandle.md)`.game`; holds an [InputSource](InputSource.md)
- written by [ActionSimulator](ActionSimulator.md) and [Simulator](Simulator.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `input` | property | The [InputSource](InputSource.md) the scene reads each frame |

## Example
```ts
scene.game.input = adapter.makeScriptedInput(recording);
```

## Design notes
The scene reads its keys through this holder, so replacing `input` is all it takes to replay a different recording on the same scene.
