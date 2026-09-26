# PlanStats

`packages/agent/src/Plan.ts` · interface

Step counts for a plan.

## Relationships
- counted by [PlanBuilder](PlanBuilder.md); held by [Plan](Plan.md); copied into [SolutionStats](SolutionStats.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `steps` | property | All steps |
| `jumps` | property | Jumps |
| `walks` | property | Walks and run-offs |
| `drops` | property | Drops and drop-and-releases |

## Example
```ts
console.log(`${plan.stats.steps} steps, ${plan.stats.jumps} jumps`);
```

## Design notes
Run-offs count as walks and both drop kinds as drops, as the dialog has always shown them.
