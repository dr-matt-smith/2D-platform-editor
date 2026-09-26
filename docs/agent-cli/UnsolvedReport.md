# UnsolvedReport

`apps/agent-cli/src/LevelReport.ts` · interface

The report when the agent ran but found no solution within the budget.

## Relationships
- one case of the `LevelReport` union
- has a [LevelInfo](LevelInfo.md)
- built by [LevelSolver](LevelSolver.md); `reasons` from `LevelSolver.describeFailure`

## Members
| Member | Kind | Description |
|---|---|---|
| `status` | property | `ReportStatus.Unsolved` |
| `level`, `warnings` | properties | As in every report |
| `budgetMs`, `elapsedMs` | properties | The budget and the time taken |
| `attempts` | property | Plan/simulate iterations tried |
| `reasons` | property | Human-readable explanations, most important first |
| `lastSim` | property | How the last replay ended, or `null` |
| `unreachable` | property | Goals the last plan could not reach |

## Example
```ts
if (report.status === ReportStatus.Unsolved) report.reasons.forEach((r) => console.log(r));
```

## Design notes
A discriminated union case, like [SolvedReport](SolvedReport.md).
