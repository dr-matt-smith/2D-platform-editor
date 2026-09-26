# InvalidReport

`apps/agent-cli/src/LevelReport.ts` · interface

The report when the level fails validation, so the agent is not run.

## Relationships
- one case of the `LevelReport` union
- has a [LevelInfo](LevelInfo.md)
- built by [LevelSolver](LevelSolver.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `status` | property | `ReportStatus.Invalid` |
| `level`, `warnings` | properties | As in every report |
| `errors` | property | The blocking validation issues |

## Example
```ts
if (report.status === ReportStatus.Invalid) report.errors.map(TextFormatter.issueLine);
```

## Design notes
A discriminated union case, like [SolvedReport](SolvedReport.md).
