# TextFormatter

`apps/agent-cli/src/TextFormatter.ts` · class

Reports as aligned text for people: the default output. A level report lists the level, any warnings, the verdict and a table of solutions (or the reasons / problems); a sweep is a table with one row per level and a summary line.

## Relationships
- implements [ReportFormatter](ReportFormatter.md)
- the other implementation is [JsonFormatter](JsonFormatter.md)
- chosen by [AgentCommand](AgentCommand.md)`.formatter()` when `--json` is absent

## Members
| Member | Kind | Description |
|---|---|---|
| `MAX_LISTED_ISSUES` | static readonly | `10`: longer problem lists end "... and N more" |
| `report(report)` | method | The multi-line report for one level |
| `issueLine(issue)` | static method | "line 3, col 5: error: unknown glyph 'Q'" |
| `sweepHeader(idWidth)` | method | The sweep table header |
| `sweepRow(report, idWidth)` | method | One level's row: result, solutions, best frames, jumps, time |
| `sweepSummary(summary)` | method | A blank line, then `summaryLine` |
| `summaryLine(summary)` | method | "Summary: 5/6 solved, 1 unsolved in 3.4s (failed: fred)" |

## Example
```ts
const text = new TextFormatter();
console.log(text.report(report));
text.sweepRow(report, 8);   // 'tutorial  solved            1           83      3  59ms'
```

## Design notes
- **Polymorphism.** Callers hold a [ReportFormatter](ReportFormatter.md) and
  never know this class is behind it.
- **Private static helpers.** Column layout (`table`, `sweepLine`),
  `duration` and `plural` are private: they are how this class works, not
  part of what it offers.
