# WaitAction

`packages/agent/src/WaitAction.ts` · class

Press nothing for a number of frames (lets a fall settle).

## Relationships
- extends [Action](Action.md) directly (it holds no direction); kind [ActionKind](ActionKind.md)`.Wait`
- not in the [ActionCatalog](ActionCatalog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new WaitAction(frames)` | constructor | |
| `frames` | readonly property | How long to wait |
| `nominalCost` | get accessor | `frames` |
| `toRecording(frameStart?)` | method | No events: only time passes |
| `describe()` | method | "wait 3 frames" |

## Example
```ts
new WaitAction(20).toRecording(0); // []
```

## Design notes
The one action that isn't a [MoveAction](MoveAction.md) — the reason the
hierarchy has that middle layer.
