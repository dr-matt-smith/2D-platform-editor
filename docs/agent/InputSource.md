# InputSource

`packages/agent/src/InputSource.ts` · interface

Any key source a scene reads: a keyboard or a recording.

## Relationships
- extended by [ScriptedInputHandle](ScriptedInputHandle.md)
- held by [SceneGame](SceneGame.md)`.input`
- the engine's own `InputSource` interface has the same shape

## Members
| Member | Kind | Description |
|---|---|---|
| `isDown(key)` | method | Is the key held? |
| `wasPressed(key)` | method | Did it go down this frame? |
| `endFrame()` | method | Called at the end of every frame |
| `advance?(frame)` | optional method | Scripted sources only: apply events up to `frame` |

## Example
```ts
if (input.wasPressed('space')) jump();
```

## Design notes
The agent defines its own copy rather than importing the engine's, so the contract is complete without the engine. `advance` is optional because a keyboard has no frame clock.
