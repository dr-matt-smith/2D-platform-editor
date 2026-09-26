# RecordingEvent

`packages/agent/src/RecordingEvent.ts` · interface

One scripted key event: `key` goes down (or up) at `frame`. The same file defines `Recording`, an array of them — what the planner emits and the engine replays.

## Relationships
- produced by [Action](Action.md)`.toRecording` and [PlanBuilder](PlanBuilder.md); held by [Plan](Plan.md) and [Solution](Solution.md)
- replayed by [ScriptedInputHandle](ScriptedInputHandle.md); the engine's `RecordingEvent` has the same shape

## Members
| Member | Kind | Description |
|---|---|---|
| `frame` | property | The frame the event fires on |
| `key` | property | `'left'`, `'right'` or `'space'` |
| `down` | property | Pressed (true) or released (false) |

## Example
```ts
const recording: Recording = [{ frame: 1, key: 'right', down: true }, { frame: 6, key: 'right', down: false }];
```

## Design notes
Plain data: recordings are replayed by the engine, printed as JSON by the CLI and compared against the Python port, so they stay simple objects.
