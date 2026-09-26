# RunOffAction

`packages/agent/src/RunOffAction.ts` · class

Walk `walkCells` cells and keep holding the direction, carrying the walking
speed into a fall if the platform ends. Where the player steps off is
decided by the level, not the recording; with no ledge it is a long walk.

## Relationships
- extends [MoveAction](MoveAction.md); kind [ActionKind](ActionKind.md)`.RunOff`
- uses [WalkAction](WalkAction.md)`.FRAMES_PER_CELL` and [DropAction](DropAction.md)`.HOLD_FRAMES_BUDGET`

## Members
| Member | Kind | Description |
|---|---|---|
| `new RunOffAction(dir, walkCells)` | constructor | |
| `walkCells` | readonly property | Cells walked before the fall |
| `nominalCost` | get accessor | `walkCells * 5 + 60` |
| `leavesGround` | get accessor | `true` |
| `toRecording(frameStart?)` | method | One hold covering the walk and the fall |
| `describe(subgoal?)` | method | "walk right 2 cells then carry into fall toward …" |

## Example
```ts
new RunOffAction(Direction.Left, 3).toRecording(0); // left↓ @0, left↑ @75
```

## Design notes
Composes two other actions' timings by referring to their constants rather
than inheriting from either.
