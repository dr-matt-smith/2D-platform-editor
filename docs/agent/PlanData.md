# PlanData

`packages/agent/src/Plan.ts` · interface

The data a [Plan](Plan.md) is made from.

## Relationships
- implemented by [Plan](Plan.md); passed to its constructor by [PlanBuilder](PlanBuilder.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `trace`, `recording`, `stats` | properties | Steps, key events, counts |
| `graph` | property | A [LevelLayout](LevelLayout.md), or null |
| `goals`, `unreachable` | properties | Goal keys in order; [UnreachableGoal](UnreachableGoal.md)s |

## Example
```ts
new Plan({ trace: [], recording: [], stats, graph: null, goals: [], unreachable: [] });
```

## Design notes
A parameter object: six named fields read better than six positional constructor arguments, and `Plan implements PlanData` keeps the two in step.
