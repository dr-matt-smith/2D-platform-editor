# AgentCommand

`apps/agent-cli/src/AgentCommand.ts` · abstract class

The base of the commands that run the agent. It holds the shared [RunOptions](RunOptions.md) and builds the collaborators every such command needs, so each subclass only says what to solve and what to print.

## Relationships
- implements [Command](Command.md)
- extended by [SolveCommand](SolveCommand.md) and [SolveAllCommand](SolveAllCommand.md)
- holds [RunOptions](RunOptions.md)
- makes a [ContentStore](ContentStore.md), a [LevelSolver](LevelSolver.md) and a [ReportFormatter](ReportFormatter.md) ([TextFormatter](TextFormatter.md) or [JsonFormatter](JsonFormatter.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `new AgentCommand(options)` | protected constructor | Only subclasses construct |
| `options` | readonly property | The [RunOptions](RunOptions.md) from the command line |
| `execute(context)` | abstract method | What the command does; returns an [ExitCode](ExitCode.md) |
| `formatter()` | protected method | [JsonFormatter](JsonFormatter.md) with `--json`, else [TextFormatter](TextFormatter.md) |
| `store(context)` | protected method | A [ContentStore](ContentStore.md) on `--content`, reading through `context.files` |
| `solver()` | protected method | A [LevelSolver](LevelSolver.md) on the JS engine |

## Example
```ts
class SolveCommand extends AgentCommand {
  async execute(context: CommandContext): Promise<ExitCode> {
    const store = this.store(context);
    const level = await store.prepare(await store.resolve(this.level));
    const report = await this.solver().solve(level, this.options.budgetMs);
    context.output.out(this.formatter().report(report));
    return report.status === ReportStatus.Solved ? ExitCode.Solved : ExitCode.Failed;
  }
}
```

## Design notes
- **Abstract class vs interface.** [Command](Command.md) is the contract
  callers see; `AgentCommand` is shared *implementation* for a true "is-a"
  family. [HelpCommand](HelpCommand.md) is a command but not an agent
  command, so it implements the interface without inheriting any of this.
- **Protected helpers.** `formatter`, `store` and `solver` are for
  subclasses only; outside code sees just `options` and `execute`.
- **One decision, one place.** Text vs JSON is decided once, in
  `formatter()`. Everything after that is polymorphism.
