# GameOptions

`packages/engine/src/Game.ts` · interface

What `new Game(...)` needs.

## Relationships
- passed to [Game](Game.md)'s constructor
- holds an [InputSource](InputSource.md) and a [SoundBank](SoundBank.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `canvas` | property | The `<canvas>` to draw on |
| `sounds` | property | The [SoundBank](SoundBank.md) |
| `input` | property | The [InputSource](InputSource.md) |

## Example
```ts
new Game({ canvas, sounds: new SoundBank(), input: KeyboardInput.attach() });
```

## Design notes
The game is *given* its collaborators (dependency injection) rather than
creating them, so the launcher chooses keyboard or recording, and tests can
pass fakes.
