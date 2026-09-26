# HelpCommand

`apps/agent-cli/src/HelpCommand.ts` · class

`--help` / `-h`: print the usage text to stdout and exit 0.

## Relationships
- implements [Command](Command.md) directly (it is not an [AgentCommand](AgentCommand.md))
- created by [ArgParser](ArgParser.md) with `ArgParser.USAGE`

## Members
| Member | Kind | Description |
|---|---|---|
| `new HelpCommand(usage)` | constructor | The text to print |
| `usage` | readonly property | The usage text |
| `execute(context)` | method | Print `usage` with `context.output.out`; returns `ExitCode.Solved` |

## Example
```ts
await new HelpCommand(ArgParser.USAGE).execute(context);
```

## Design notes
- **Implements, does not inherit.** Help needs no options, content or
  solver, so it implements [Command](Command.md) without the
  [AgentCommand](AgentCommand.md) base: composition over inheritance.
- **Text passed in.** The usage text is a constructor argument rather than
  an import of [ArgParser](ArgParser.md), which avoids a circular import
  (the parser creates this class) and makes the class trivial to test.
