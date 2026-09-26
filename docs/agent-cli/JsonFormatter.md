# JsonFormatter

`apps/agent-cli/src/JsonFormatter.ts` · class

Reports as JSON for other tools (`--json`). The report objects already are the JSON shape, so this is `JSON.stringify` with two-space indents. A sweep prints a single `{ summary, levels }` object at the end.

## Relationships
- implements [ReportFormatter](ReportFormatter.md)
- the other implementation is [TextFormatter](TextFormatter.md)
- chosen by [AgentCommand](AgentCommand.md)`.formatter()` with `--json`

## Members
| Member | Kind | Description |
|---|---|---|
| `report(report)` | method | The report as JSON |
| `sweepHeader()` | method | `null`: nothing streams |
| `sweepRow()` | method | `null`: nothing streams |
| `sweepSummary(summary, reports)` | method | `{ summary, levels }` as JSON |

## Example
```ts
const json = new JsonFormatter();
JSON.parse(json.report(report)).status;   // 'solved'
```

## Design notes
The same interface, a very different behaviour: that is polymorphism. An
implementation may take fewer parameters than the interface declares
(`sweepHeader()` ignores `idWidth`), which TypeScript allows.
