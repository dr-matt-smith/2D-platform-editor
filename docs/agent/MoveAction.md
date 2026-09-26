# MoveAction

`packages/agent/src/MoveAction.ts` · abstract class

An [Action](Action.md) that holds a direction key — every action except
waiting. These are the candidates the planner tries from each state.

## Relationships
- extends [Action](Action.md)
- extended by [WalkAction](WalkAction.md), [JumpAction](JumpAction.md), [DropAction](DropAction.md), [DropReleaseAction](DropReleaseAction.md) and [RunOffAction](RunOffAction.md)
- listed by [ActionCatalog](ActionCatalog.md); carried by [NavEdge](NavEdge.md) and [PerFrameEdge](PerFrameEdge.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new MoveAction(dir)` | protected constructor | |
| `dir` | readonly property | The held [Direction](Direction.md) |
| `sortKey` | get accessor | "kind\|dir\|holdFrames\|releaseFrame\|walkCells" (blank where not used) |
| `sortParams()` | protected method | The last three parts; subclasses with a parameter override it |

## Example
```ts
new JumpAction(Direction.Right, 12).sortKey;  // "jump|right|12||"
new RunOffAction(Direction.Left, 3).sortKey;  // "run_off|left|||3"
```

## Design notes
- **An abstract middle layer.** "Holds a direction" is shared by five
  classes but not by waiting, so it gets its own abstract class rather
  than an optional `dir` on every action.
- **Template method in miniature.** `sortKey` fixes the key's shape; each
  subclass only fills in its own parameter through `sortParams`. The
  per-frame planner sorts edges by this key to break ties the same way on
  every run.
