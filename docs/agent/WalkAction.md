# WalkAction

`packages/agent/src/WalkAction.ts` · class

Hold a direction for a whole number of cells, then let go.

## Relationships
- extends [MoveAction](MoveAction.md); kind [ActionKind](ActionKind.md)`.Walk`
- `FRAMES_PER_CELL` is also used by [RunOffAction](RunOffAction.md) and the planners

## Members
| Member | Kind | Description |
|---|---|---|
| `new WalkAction(dir, cells)` | constructor | |
| `cells` | readonly property | Cells to walk |
| `FRAMES_PER_CELL` | static readonly | 5 (TILE 20 / (SPEED 240 / 60)) |
| `nominalCost` | get accessor | `cells * 5` |
| `toRecording(frameStart?)` | method | Direction down at the start, up `cells * 5` frames later |
| `describe(subgoal?)` | method | "walk right 1 cell toward …" |

## Example
```ts
new WalkAction(Direction.Right, 2).toRecording(10);
// [{ frame: 10, key: 'right', down: true }, { frame: 20, key: 'right', down: false }]
```

## Design notes
The catalog only offers one-cell walks; longer walks come from the search
chaining them, which keeps the candidate list short.
