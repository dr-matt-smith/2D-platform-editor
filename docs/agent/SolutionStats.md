# SolutionStats

`packages/agent/src/Solution.ts` · interface

A solution's numbers, as the dialog and the CLI show them.

## Relationships
- held by [Solution](Solution.md)`.stats`; built from [PlanStats](PlanStats.md) and a [SimResult](SimResult.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `steps`, `walks`, `jumps`, `drops` | properties | From the plan |
| `attempts` | property | Which attempt found it |
| `frame` | property | The frame the replay won on |
| `score` | property | Pickups collected |

## Example
```ts
const { frame, jumps, score } = result.solution.stats;
```

## Design notes
Key order matters: it is part of the CLI's JSON output.
