# DropReleaseAction

`packages/agent/src/DropReleaseAction.ts` · class

Walk off a ledge and let go of the direction at `releaseFrame`, so the rest
of the fall is straight down — the drop's version of releasing mid-jump.

## Relationships
- extends [MoveAction](MoveAction.md) (not [DropAction](DropAction.md)); kind [ActionKind](ActionKind.md)`.DropRelease`
- four of them per direction in [ActionCatalog](ActionCatalog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new DropReleaseAction(dir, releaseFrame)` | constructor | |
| `releaseFrame` | readonly property | Frame at which the direction is released |
| `nominalCost` | get accessor | `DropAction.HOLD_FRAMES_BUDGET` |
| `leavesGround` | get accessor | `true` |
| `toRecording(frameStart?)` | method | Direction down, up at `releaseFrame` |
| `describe(subgoal?)` | method | "drop left (release at frame 8) toward …" |

## Example
```ts
new DropReleaseAction(Direction.Right, 16).toRecording(50); // right↓ @50, right↑ @66
```

## Design notes
It is *not* a subclass of [DropAction](DropAction.md): the planners treat
the two differently when writing recordings, and an `instanceof DropAction`
test must not match both. Sharing the budget constant is enough reuse.
