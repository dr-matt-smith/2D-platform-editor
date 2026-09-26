# Output

`apps/agent-cli/src/Output.ts` · interface

Where the CLI writes: reports to `out` (stdout), errors to `err` (stderr).

## Relationships
- implemented by [ConsoleOutput](ConsoleOutput.md) and by test collectors
- part of [CommandContext](CommandContext.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `out(text)` | method | Write a report line |
| `err(text)` | method | Write an error |

## Example
```ts
const lines: string[] = [];
const collect: Output = { out: (t) => lines.push(t), err: (t) => lines.push(t) };
```

## Design notes
Depending on this interface instead of `console` is what lets the tests
check the exact text and which stream it went to.
