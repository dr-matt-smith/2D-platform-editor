# UnreachableGoal

`packages/agent/src/Plan.ts` · interface

A goal cell the planner found no path to.

## Relationships
- extends [Cell](Cell.md); listed in [Plan](Plan.md)`.unreachable`; `kind` is a [GoalKind](GoalKind.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `r`, `c` | properties | The cell |
| `kind` | property | [GoalKind](GoalKind.md)`.Pickup` or `.Exit` |

## Example
```ts
if (plan.unreachable.some((u) => u.kind === GoalKind.Exit)) warn('exit unreachable');
```

## Design notes
An unreachable pickup doesn't stop planning (the exit may not need it); an unreachable exit ends the plan.
