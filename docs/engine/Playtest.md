# Playtest

`packages/engine/src/Playtest.ts` · class

A level being played on a canvas. `Playtest.launch(...)` checks the level,
sizes the canvas, wires input, sounds, game loop and scene together, and
returns the running playtest; the page calls `restart()` and `exit()` from
its own buttons and keys.

## Relationships
- checks the level with a [PlaytestGate](PlaytestGate.md); sizes the canvas from the level's viewport or a [World](World.md)
- creates a [KeyboardInput](KeyboardInput.md) or (with [LaunchOptions](LaunchOptions.md)`.recording`) a [ScriptedInput](ScriptedInput.md), a [SoundBank](SoundBank.md), a [Game](Game.md) and a [PlaytestScene](PlaytestScene.md)
- returns a [PlaytestLaunch](PlaytestLaunch.md); `phase` is a [GamePhase](GamePhase.md)
- used by the editor ([PlayModeController](../editor/PlayModeController.md)) and the player app ([PlaySession](../player/PlaySession.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `launch(level, legend, tileset, canvas, options?)` | static method | Start a playtest (see [PlaytestLaunch](PlaytestLaunch.md) for the outcomes). Call it from a user gesture |
| `isOpen` | static get accessor | Is a playtest open right now? |
| `phase` | get accessor | The scene's [GamePhase](GamePhase.md) |
| `isClosed` | get accessor | Has `exit()` been called? |
| `restart()` | method | Start the level again |
| `exit()` | method | Stop the loop, release the keyboard, fire the `onExit` callback; only the first call acts |
| `onExit(listener)` | method | Register a callback for when the playtest ends (replaces any earlier one) |

## Example
```ts
const r = Playtest.launch(level, legend, tileset, canvas);
if (r.playtest) {
  const playtest = r.playtest;
  restartButton.onclick = () => playtest.restart();
  exitButton.onclick = () => playtest.exit();
}
```

## Design notes
- **Static factory with outcomes.** Launching can be refused, so it is a
  static method returning a result, not a constructor that might half-build
  an object. The constructor is private.
- **One at a time — class-level state.** A private *static* flag is shared
  by every launch, so a second Play shortcut while one is open does nothing
  instead of stacking a second game loop and a second set of key listeners.
- **Facade.** The page sees four small methods; the gate, canvas sizing,
  input choice, audio pre-warm, loop and scene stay inside.
- **Separation of concerns.** It never touches the page outside the canvas;
  toolbar buttons and Esc belong to the page.
