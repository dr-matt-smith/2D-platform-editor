# SolveAllCommand

`apps/agent-cli/src/SolveAllCommand.ts` · class

`deno task solve --all`: solve every bundled level in manifest order, then print a summary. It is a regression sweep, so it exits 1 if any level is not solved.

## Relationships
- extends [AgentCommand](AgentCommand.md) (and so implements [Command](Command.md))
- created by [ArgParser](ArgParser.md)
- reads the manifest with [ContentStore](ContentStore.md), solves each level with [LevelSolver](LevelSolver.md)
- totals the reports with [SweepSummary](SweepSummary.md); prints through a [ReportFormatter](ReportFormatter.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new SolveAllCommand(options)` | constructor | The [RunOptions](RunOptions.md) |
| `execute(context)` | async method | Sweep and print; `Solved` only if every level was solved |

## Example
```ts
const code = await new SolveAllCommand(options).execute(context);
// text: a header, one row per level as it finishes, a blank line, "Summary: 5/5 solved in 2.1s"
// --json: one { summary, levels } object at the end
```

## Design notes
- **Streaming through an interface.** Levels are solved one at a time and
  each row is printed as it finishes. The formatter decides whether there
  *is* a row: [TextFormatter](TextFormatter.md) returns one,
  [JsonFormatter](JsonFormatter.md) returns `null` and prints everything at
  the end. The command has no `if (json)`.
- **Behaviour in the summary.** The exit code comes from
  `summary.allSolved`, a question the [SweepSummary](SweepSummary.md) object
  answers about itself.
