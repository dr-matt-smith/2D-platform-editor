# AgentCli

`apps/agent-cli/src/AgentCli.ts` · class

The CLI as a whole: parse the command line into a [Command](Command.md), execute it, and return an [ExitCode](ExitCode.md). It turns the two expected kinds of failure into a message on stderr and exit code 2; anything else is a bug and is left to crash with its stack trace.

## Relationships
- built by `main.ts` (`run(argv, io)`) with the real [ConsoleOutput](ConsoleOutput.md) and [DenoFileReader](DenoFileReader.md)
- holds a [CommandContext](CommandContext.md) and passes it to every command
- uses [ArgParser](ArgParser.md) to make the command
- catches [UsageError](UsageError.md) (prints the message and the usage text) and [InputError](InputError.md) (prints the message)

## Members
| Member | Kind | Description |
|---|---|---|
| `new AgentCli(context)` | constructor | Keep the output and files every command will use |
| `run(argv)` | async method | Parse, execute and return the exit code; never throws for bad input |

## Example
```ts
const io = { out: (t: string) => lines.push(t), err: (t: string) => errors.push(t) };
const code = await new AgentCli({ output: io, files: new DenoFileReader() }).run(['tutorial', '--json']);
// code === ExitCode.Solved, lines[0] is the JSON report
```

## Design notes
- **One place for error policy.** Commands just throw; `AgentCli` decides
  what an error means for the user. Checking with `instanceof` against the
  error *classes* is why [UsageError](UsageError.md) and
  [InputError](InputError.md) are types of their own.
- **Polymorphism at the top.** `run` never asks which command it has: it
  calls `execute`, which each [Command](Command.md) implements its own way.
- **Dependency injection.** The context arrives in the constructor, so the
  whole CLI runs in tests against fakes (see `AgentCli.test.ts`).
