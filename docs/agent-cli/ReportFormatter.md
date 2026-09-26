# ReportFormatter

`apps/agent-cli/src/ReportFormatter.ts` · interface

Turns reports into the text the CLI prints. A sweep prints as it goes (a header, then a row per level) and ends with a summary; a formatter with nothing to print for a step returns `null`.

## Relationships
- implemented by [TextFormatter](TextFormatter.md) and [JsonFormatter](JsonFormatter.md)
- chosen by [AgentCommand](AgentCommand.md)`.formatter()`; used by [SolveCommand](SolveCommand.md) and [SolveAllCommand](SolveAllCommand.md)
- prints `LevelReport`s and a [SweepSummary](SweepSummary.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `report(report)` | method | One level's report |
| `sweepHeader(idWidth)` | method | Before the first level of a sweep, or `null` |
| `sweepRow(report, idWidth)` | method | As each level finishes, or `null` |
| `sweepSummary(summary, reports)` | method | Once the sweep is done |

## Example
```ts
const formatter: ReportFormatter = json ? new JsonFormatter() : new TextFormatter();
output.out(formatter.report(report));
```

## Design notes
The polymorphism example of this app: one interface, two very different
implementations, and callers that never branch on which they have.
