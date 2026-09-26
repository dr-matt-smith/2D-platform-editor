# JumpAction

`packages/agent/src/JumpAction.ts` · class

Jump while holding a direction, and let go of the direction after
`holdFrames` frames. Letting go mid-arc caps the horizontal travel, which is
how the player lands precisely on a small platform instead of overshooting.

## Relationships
- extends [MoveAction](MoveAction.md); kind [ActionKind](ActionKind.md)`.Jump`
- twelve of them per direction in [ActionCatalog](ActionCatalog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new JumpAction(dir, holdFrames)` | constructor | |
| `holdFrames` | readonly property | Frame at which the direction is released |
| `ARC_FRAMES` | static readonly | 42, a full arc (2 * JUMP_FORCE / GRAVITY * 60) |
| `nominalCost` | get accessor | `ARC_FRAMES`; the simulator reports the real landing |
| `leavesGround` | get accessor | `true` |
| `toRecording(frameStart?)` | method | Direction and space down, space up a frame later, direction up at `holdFrames` |
| `describe(subgoal?)` | method | "jump left (release at frame 26) toward …" |

## Example
```ts
new JumpAction(Direction.Left, 26).toRecording(100);
// left↓ @100, space↓ @100, space↑ @101, left↑ @126
```

## Design notes
Overrides `sortParams` so its hold frame takes part in tie-breaking. The
real cost can be shorter (a higher platform) or longer (a lower one) than
`ARC_FRAMES`; only the simulator knows.
