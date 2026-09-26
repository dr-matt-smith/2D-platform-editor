# ActionCatalog

`packages/agent/src/ActionCatalog.ts` · class

The 46 candidate actions the planners try from every state. Per direction:
a one-cell walk, 12 jumps, a drop, 4 drop-and-release variants and 5
run-off lengths.

## Relationships
- lists [WalkAction](WalkAction.md), [JumpAction](JumpAction.md), [DropAction](DropAction.md), [DropReleaseAction](DropReleaseAction.md) and [RunOffAction](RunOffAction.md) instances, typed as [MoveAction](MoveAction.md)
- used by [NavGraph](NavGraph.md) and [PerFrameExpander](PerFrameExpander.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `all()` | static method | Every candidate, left then right, in a fixed order (a frozen, shared list) |
| `RELEASE_FRAMES` | static readonly | Jump release frames: 2, 4, 8 … 40, 42 |
| `DROP_RELEASE_FRAMES` | static readonly | 8, 16, 24, 32 |
| `RUN_OFF_WALK_CELLS` | static readonly | 2 … 6 |

## Example
```ts
const jumps = ActionCatalog.all().filter((a) => a instanceof JumpAction); // 24
```

## Design notes
- **The order matters.** It breaks ties in the search, so changing it
  changes the plans (and the golden vectors).
- **Nothing is filtered here.** Whether an action is possible from a
  state is the simulator's job; the catalog only says what to try.
- **Built once.** Actions are immutable, so one frozen list serves every
  expansion (the static field is filled on first use).
