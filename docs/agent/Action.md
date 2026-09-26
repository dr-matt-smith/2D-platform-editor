# Action

`packages/agent/src/Action.ts` · abstract class

Something the player can physically do: a short, fixed pattern of key
presses. Every edge the planners search over is one action, and the physics
simulator — not the action — decides where it ends up.

## Relationships
- extended by [MoveAction](MoveAction.md) (and through it [WalkAction](WalkAction.md), [JumpAction](JumpAction.md), [DropAction](DropAction.md), [DropReleaseAction](DropReleaseAction.md), [RunOffAction](RunOffAction.md)) and by [WaitAction](WaitAction.md)
- simulated by [ActionSimulator](ActionSimulator.md); its `kind` is an [ActionKind](ActionKind.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `kind` | abstract readonly property | Which [ActionKind](ActionKind.md) |
| `nominalCost` | abstract get accessor | Frames the key pattern lasts (for airborne actions, only the hold window) |
| `leavesGround` | get accessor | `false` by default; airborne actions override it to `true` |
| `toRecording(frameStart?)` | abstract method | The key events, starting at `frameStart` (default 0) |
| `describe(subgoalName?)` | abstract method | A readable description |
| `toward(subgoalName)` | protected static method | " toward …", or nothing |

## Example
```ts
const actions: Action[] = [new WalkAction(Direction.Right, 2), new WaitAction(10)];
for (const a of actions) console.log(a.describe(), a.nominalCost, a.toRecording(1));
```

## Design notes
- **Polymorphism replaces switches.** Before, four functions each switched
  on the kind (cost, recording, description, "is it airborne?"). Now each
  subclass answers for itself, and adding an action means adding a class,
  not editing four switches.
- **Abstract members vs. a default.** Cost, recording and description are
  abstract because every action differs. `leavesGround` has a default
  (`false`) that the airborne actions override.
- **Immutable.** Actions have only readonly fields, which is what lets
  [ActionCatalog](ActionCatalog.md) share one list of them everywhere.
