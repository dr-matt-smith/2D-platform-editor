# CommandContext

`apps/agent-cli/src/CommandContext.ts` · interface

The outside world a command may touch, handed to `Command.execute`: where to write and how to read files.

## Relationships
- passed to every [Command](Command.md) by [AgentCli](AgentCli.md)
- holds an [Output](Output.md) and a [FileReader](FileReader.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `output` | property | An [Output](Output.md) |
| `files` | property | A [FileReader](FileReader.md) |

## Example
```ts
const context: CommandContext = { output: new ConsoleOutput(), files: new DenoFileReader() };
```

## Design notes
Grouping the injected collaborators in one object keeps `execute` to one
parameter and makes it obvious that a command has no other way out: no
global `console`, no `Deno.readTextFile`.
