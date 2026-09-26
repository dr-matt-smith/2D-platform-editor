# UsageError

`apps/agent-cli/src/UsageError.ts` · class

A bad command line: an unknown flag, a missing value, no level. [AgentCli](AgentCli.md) prints `error: <message>` and the usage text to stderr and exits with `ExitCode.Usage` (2).

## Relationships
- extends `Error`
- thrown by [ArgParser](ArgParser.md); caught by [AgentCli](AgentCli.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `name` | property | `'UsageError'` (shown in stack traces) |
| `message` | property (inherited) | What was wrong, e.g. "unknown option '--verbose'" |

## Example
```ts
throw new UsageError(`${name} needs a value`);
```

## Design notes
A subclass that adds nothing but its *type*: that is enough for
`err instanceof UsageError` to tell this failure from others.
