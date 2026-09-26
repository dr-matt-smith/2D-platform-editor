# RecordingEvent

`packages/engine/src/RecordingEvent.ts` · interface

One event of an input recording: at `frame`, `key` goes down or up. A
recording is an array of these.

## Relationships
- replayed by [ScriptedInput](ScriptedInput.md)
- `key` is a [Key](Key.md) (or `KeyName`)
- carried by [LaunchOptions](LaunchOptions.md)`.recording`; the agent's `Recording` has the same shape

## Members
| Member | Kind | Description |
|---|---|---|
| `frame` | property | Frame number (60 per second) |
| `key` | property | The key's normalised name |
| `down` | property | `true` = pressed, `false` = released |

## Example
```ts
const walkRightOneSecond: RecordingEvent[] = [
  { frame: 0, key: Key.Right, down: true },
  { frame: 60, key: Key.Right, down: false },
];
```

## Design notes
Plain data behind an interface: the agent package produces recordings
without importing the engine, and the shapes match structurally.
