# Game

`packages/engine/src/Game.ts` · class

The game loop. Owns the canvas, input and sounds, holds the active
[Scene](Scene.md), and runs a `requestAnimationFrame` loop that updates,
clears and draws it each frame.

## Relationships
- implements [SceneHost](SceneHost.md), so a [Scene](Scene.md) can reach its input and sounds
- has an [InputSource](InputSource.md) and a [SoundBank](SoundBank.md) (given in [GameOptions](GameOptions.md))
- hosts one [Scene](Scene.md) at a time — generic `Game<S extends Scene>`
- created and stopped by [Playtest](Playtest.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `MAX_DT` | static readonly | `1/30` — the longest time step simulated in one frame |
| `frameDt(now, last)` | static method | Seconds to simulate for a frame: elapsed time, clamped to `[0, MAX_DT]` |
| `new Game({ canvas, sounds, input })` | constructor | Gets the canvas's 2D context |
| `input` | property | The [InputSource](InputSource.md) (writable, per [SceneHost](SceneHost.md)) |
| `sounds` | readonly property | The [SoundBank](SoundBank.md) |
| `scene` | get accessor | The active scene, or `null` |
| `isRunning` | get accessor | Is the loop running? |
| `setScene(scene)` | method | `exit()` the old scene, `enter()` the new one |
| `start()` | method | Start the loop: each frame `update(dt)`, clear, `draw(ctx)`, `input.endFrame()` |
| `stop()` | method | End the loop after the current frame |

## Example
```ts
const game = new Game<PlaytestScene>({ canvas, sounds: new SoundBank(), input: KeyboardInput.attach() });
game.setScene(new PlaytestScene(game, level, legend, tileset));
game.start();
// … later
game.stop();
```

## Design notes
- **Generics.** `Game<PlaytestScene>` lets the launcher read
  `game.scene.restart()` with full type checking, while `Game` itself only
  relies on what every [Scene](Scene.md) has.
- **Depends on an interface for input.** The loop calls
  `input.endFrame()` without knowing whether it has a keyboard or a
  recording.
- **Clamped time step.** At most `1/30` s so a stalled tab cannot make the
  player tunnel through a platform; never negative, because the first
  animation-frame timestamp can precede `performance.now()` and a negative
  step drops the player through the floor.
