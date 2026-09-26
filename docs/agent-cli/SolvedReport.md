# SolvedReport

`apps/agent-cli/src/LevelReport.ts` · interface

The report when the agent finds at least one solution.

## Relationships
- one case of the `LevelReport` union, with [UnsolvedReport](UnsolvedReport.md) and [InvalidReport](InvalidReport.md)
- has a [LevelInfo](LevelInfo.md) and [SolutionReport](SolutionReport.md)s
- built by [LevelSolver](LevelSolver.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `status` | property | `ReportStatus.Solved` |
| `level` | property | [LevelInfo](LevelInfo.md) |
| `warnings` | property | Non-blocking validation issues |
| `budgetMs`, `elapsedMs` | properties | The budget and the time taken |
| `solutions` | property | Up to 5 distinct solutions, fewest frames first |

## Example
```ts
if (report.status === ReportStatus.Solved) console.log(report.solutions.length);
```

## Design notes
A discriminated union case: checking `status` narrows the type, so TypeScript knows `solutions` exists.
