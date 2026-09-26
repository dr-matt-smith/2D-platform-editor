# InputError

`apps/agent-cli/src/InputError.ts` · class

A missing or unreadable input: an unknown level id, a missing file, a malformed manifest. [AgentCli](AgentCli.md) prints `error: <message>` and exits with `ExitCode.Usage` (2).

## Relationships
- extends `Error`
- thrown by [ContentStore](ContentStore.md); caught by [AgentCli](AgentCli.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `name` | property | `'InputError'` |
| `message` | property (inherited) | e.g. "level file not found: missing.txt" |

## Example
```ts
throw new InputError(`no bundled level with id '${ref}' (available: ${ids})`);
```

## Design notes
Like [UsageError](UsageError.md), a type used for `instanceof`. Unlike a
usage error, the usage text is not printed: the command line was fine.
