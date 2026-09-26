# SweepSummary

`apps/agent-cli/src/SweepSummary.ts` · class

Totals for an `--all` sweep. Its own fields are exactly [SweepTotals](SweepTotals.md), so it serialises to the same JSON `summary`; the class adds the question callers ask of it (`allSolved`).

## Relationships
- implements [SweepTotals](SweepTotals.md)
- made by [SolveAllCommand](SolveAllCommand.md) with `SweepSummary.of(reports)`
- printed by a [ReportFormatter](ReportFormatter.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new SweepSummary(totals)` | constructor | Copy the totals (in JSON key order) |
| `of(reports)` | static method | Count solved / unsolved / invalid, sum the search time, list the failed ids |
| `total`, `solved`, `unsolved`, `invalid`, `elapsedMs`, `failed` | readonly properties | As in [SweepTotals](SweepTotals.md) |
| `allSolved` | get accessor | True when every level was solved (the exit code) |

## Example
```ts
const summary = SweepSummary.of(reports);
summary.failed;        // ['fred']
summary.allSolved;     // false
JSON.stringify(summary);   // {"total":6,"solved":5,...}: the accessor is not a field
```

## Design notes
- **Static factory.** Counting reports is a calculation, so it is a static
  `of`; the constructor only stores values, which also lets tests build a
  summary with exact numbers.
- **Class over data.** A class can implement an interface that is a plain
  data shape. Getters live on the prototype, so they add behaviour without
  changing the JSON.
