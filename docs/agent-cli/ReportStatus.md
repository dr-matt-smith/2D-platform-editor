# ReportStatus

`apps/agent-cli/src/ReportStatus.ts` · enum

How a level's run ended. The values are the `status` strings in the JSON report.

## Relationships
- the `status` of [SolvedReport](SolvedReport.md), [UnsolvedReport](UnsolvedReport.md) and [InvalidReport](InvalidReport.md)
- counted by [SweepSummary](SweepSummary.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `Solved` = `'solved'` | enum member | At least one solution |
| `Unsolved` = `'unsolved'` | enum member | The agent ran and found none |
| `Invalid` = `'invalid'` | enum member | Validation failed; the agent was not run |

## Example
```ts
report.status === ReportStatus.Solved ? ExitCode.Solved : ExitCode.Failed;
```

## Design notes
A string enum whose values are the JSON strings, so the output is unchanged. The text formatter prints `status.toUpperCase()` in the sweep table.
