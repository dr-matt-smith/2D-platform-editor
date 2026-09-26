# DropAction

`packages/agent/src/DropAction.ts` · class

Walk off a ledge and keep holding the direction until landing.

## Relationships
- extends [MoveAction](MoveAction.md); kind [ActionKind](ActionKind.md)`.Drop`
- `HOLD_FRAMES_BUDGET` is also used by [DropReleaseAction](DropReleaseAction.md), [RunOffAction](RunOffAction.md) and [PerFramePlanner](PerFramePlanner.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new DropAction(dir)` | constructor | |
| `HOLD_FRAMES_BUDGET` | static readonly | 60: the longest a drop holds its direction |
| `nominalCost` | get accessor | `HOLD_FRAMES_BUDGET` |
| `leavesGround` | get accessor | `true` |
| `toRecording(frameStart?)` | method | Direction down, up 60 frames later |
| `describe(subgoal?)` | method | "drop off ledge right toward …" |

## Example
```ts
new DropAction(Direction.Right).toRecording(0); // right↓ @0, right↑ @60
```

## Design notes
The budget only bounds the recording; the simulator measures the real fall
and stops when the player lands.
