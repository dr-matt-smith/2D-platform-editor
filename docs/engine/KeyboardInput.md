# KeyboardInput

`packages/engine/src/KeyboardInput.ts` · class

Keyboard input from the browser window: which keys are held, and which went
down this frame.

## Relationships
- implements [InputSource](InputSource.md)
- normalises key names to [Key](Key.md) values
- created by [Playtest](Playtest.md) for a human player

## Members
| Member | Kind | Description |
|---|---|---|
| `attach()` | static method | Start listening to the window's `keydown`, `keyup` and `blur` |
| `isDown(key)` | method | Held right now? |
| `wasPressed(key)` | method | Went down this frame? |
| `endFrame()` | method | Clear the just-pressed set (the game loop calls it) |
| `dispose()` | method | Remove the window listeners |

## Example
```ts
const input = KeyboardInput.attach();
// … in the loop
if (input.isDown(Key.Left)) { /* run left */ }
input.endFrame();
// … on exit
input.dispose();
```

## Design notes
- **Static factory for a side effect.** Attaching window listeners is more
  than storing values, so it happens in `attach()`, which says so; the
  constructor is private and simple.
- **Encapsulated state.** The held and pressed sets are private; callers
  can only ask questions about them.
- **Arrow-function fields as handlers.** Each handler keeps `this` and is
  the same function object when added and removed, so `dispose()` really
  detaches it.
- **Losing focus releases keys.** A key released in another window never
  sends `keyup` here, so `blur` clears everything — otherwise the player
  keeps running on its own.
- Adapted from simple-platformer-1's `Input` (CC BY 4.0).
