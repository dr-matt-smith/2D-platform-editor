# Command

`apps/agent-cli/src/Command.ts` · interface

One thing the CLI can do, as parsed from the command line. [AgentCli](AgentCli.md) runs every command the same way: `execute` it and exit with the result.

## Relationships
- implemented by [HelpCommand](HelpCommand.md) and [AgentCommand](AgentCommand.md) (so [SolveCommand](SolveCommand.md) and [SolveAllCommand](SolveAllCommand.md))
- created by [ArgParser](ArgParser.md); executed by [AgentCli](AgentCli.md) with a [CommandContext](CommandContext.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `execute(context)` | method | `Promise<ExitCode>` |

## Example
```ts
const command: Command = ArgParser.parse(argv);
const code = await command.execute(context);
```

## Design notes
The Command pattern: a request turned into an object. The parser decides
*what* to do; the command knows *how*; the CLI only needs this one method.
