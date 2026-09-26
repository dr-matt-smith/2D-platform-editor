# SolveCommand

`apps/agent-cli/src/SolveCommand.ts` · class

`deno task solve <level>`: solve one level, given as a bundled id or a `.txt` path, and print its report. Exits 0 if solved, 1 if not solved or invalid.

## Relationships
- extends [AgentCommand](AgentCommand.md) (and so implements [Command](Command.md))
- created by [ArgParser](ArgParser.md)
- resolves the level with [ContentStore](ContentStore.md), solves it with [LevelSolver](LevelSolver.md), prints it with a [ReportFormatter](ReportFormatter.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new SolveCommand(level, options)` | constructor | The `<level>` argument and the [RunOptions](RunOptions.md) |
| `level` | readonly property | The level id or file path as typed |
| `execute(context)` | async method | Solve and print; returns [ExitCode](ExitCode.md) `Solved` or `Failed` |

## Example
```ts
const command = new SolveCommand('tutorial', { budgetMs: 5000, json: false, contentDir: 'content/data' });
const code = await command.execute({ output: new ConsoleOutput(), files: new DenoFileReader() });
```

## Design notes
A small subclass: everything shared lives in [AgentCommand](AgentCommand.md),
so this class is just the steps of its one job. The level is resolved
inside `execute`, not in the parser, so the parser stays free of I/O.
