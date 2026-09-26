# GoalKind

`packages/agent/src/GoalKind.ts` · enum

What a planning goal is.

## Relationships
- the `kind` of an [UnreachableGoal](UnreachableGoal.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Pickup` | `'pickup'` | A pickup cell |
| `Exit` | `'exit'` | An exit cell |

## Example
```ts
const blocked = plan.unreachable.some((u) => u.kind === GoalKind.Exit);
```

## Design notes
Appears in the CLI's JSON (`unreachable`), so the values never change.
