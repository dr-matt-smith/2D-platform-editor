# SceneHost

`packages/engine/src/SceneHost.ts` · interface

What a [Scene](Scene.md) needs from the game hosting it: the input and the
sounds.

## Relationships
- implemented by [Game](Game.md); the headless [JsPhysicsAdapter](JsPhysicsAdapter.md) passes a plain object
- has an [InputSource](InputSource.md) and a [SoundPlayer](SoundPlayer.md)
- held by every [Scene](Scene.md) as `game`

## Members
| Member | Kind | Description |
|---|---|---|
| `input` | property | The current [InputSource](InputSource.md). Writable: the agent swaps in a new recording per simulated action |
| `sounds` | readonly property | The [SoundPlayer](SoundPlayer.md) |

## Example
```ts
const host: SceneHost = { input: new ScriptedInput(), sounds: { play() {} } };
const scene = new PlaytestScene(host, level, legend, null);
```

## Design notes
**Dependency inversion.** The scene depends on this small interface rather
than on [Game](Game.md) (which needs a canvas and an animation loop). That is
what lets the same scene class run in the browser and headless in the
agent's planner, with no casts.
