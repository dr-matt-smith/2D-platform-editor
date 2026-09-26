# ScriptedInput

`packages/engine/src/ScriptedInput.ts` · class

An input source that replays a recording instead of reading the keyboard.
Drives the editor's Demo mode and every simulation the agent runs.

## Relationships
- implements [InputSource](InputSource.md), including the optional `advance`
- replays [RecordingEvent](RecordingEvent.md)s
- created by [Playtest](Playtest.md) (Demo mode), [JsPhysicsAdapter](JsPhysicsAdapter.md) (for the agent) and [PlaytestScene](PlaytestScene.md) (an empty one, for the spawn settle)

## Members
| Member | Kind | Description |
|---|---|---|
| `new ScriptedInput(recording?)` | constructor | Copies and sorts the recording by frame; empty by default |
| `advance(frame)` | method | Apply every event up to `frame`; a new frame first clears the just-pressed set |
| `isDown(key)` | method | Held right now? |
| `wasPressed(key)` | method | Went down on the current frame? |
| `endFrame()` | method | Does nothing: `advance` clears presses as each frame starts |
| `dispose()` | method | Does nothing: a recording holds no listeners |

## Example
```ts
const input = new ScriptedInput([
  { frame: 0, key: 'right', down: true },
  { frame: 30, key: 'space', down: true },
  { frame: 31, key: 'space', down: false },
]);
input.advance(30);
input.wasPressed(Key.Space); // true
```

## Design notes
- **Same interface, different source.** It mirrors
  [KeyboardInput](KeyboardInput.md)'s press rule (a press only counts if the
  key wasn't already held), so a replay behaves exactly like the keys
  being pressed.
- **Null object.** An empty recording is an input with no keys ever
  pressed; the scene's spawn settle uses one instead of a special stub.
- **Defensive copy.** The recording is copied before sorting, so the
  caller's array is never changed.
