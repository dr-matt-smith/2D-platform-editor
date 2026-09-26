# InputSource

`packages/engine/src/InputSource.ts` · interface

Where the game reads its keys from. The game loop, the scene and the player
depend on this interface and never know which implementation they have.

## Relationships
- implemented by [KeyboardInput](KeyboardInput.md) (the real keyboard) and [ScriptedInput](ScriptedInput.md) (a recording)
- keys are named by [Key](Key.md) / `KeyName`
- held by [Game](Game.md) and [SceneHost](SceneHost.md); passed to [Player](Player.md) in an [UpdateContext](UpdateContext.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `isDown(key)` | method | Is the key held right now? |
| `wasPressed(key)` | method | Did it go down this frame? |
| `endFrame()` | method | Called by the game loop at the end of every frame |
| `dispose()` | method | Release anything held (e.g. window listeners) |
| `advance?(frame)` | optional method | Scripted sources only: apply the recording up to `frame` |

## Example
```ts
function jumpRequested(input: InputSource): boolean {
  return input.wasPressed(Key.Space) || input.wasPressed(Key.Up);
}
jumpRequested(KeyboardInput.attach());
jumpRequested(new ScriptedInput(recording));
```

## Design notes
- **Polymorphism through an interface.** Two unrelated classes (one wraps
  browser events, one replays an array) share no code, so they share an
  interface rather than a base class. The editor's Demo mode and the
  agent's simulator swap one for the other without the scene noticing.
- **An optional member.** Only scripted sources need a frame clock, so
  `advance` is optional; [PlaytestScene](PlaytestScene.md) calls it when
  present. The agent's own `InputSource` interface has the same shape.
