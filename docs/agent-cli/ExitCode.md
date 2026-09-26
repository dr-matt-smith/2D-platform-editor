# ExitCode

`apps/agent-cli/src/ExitCode.ts` · enum

The process exit codes the CLI promises.

## Relationships
- returned by every [Command](Command.md) and by [AgentCli](AgentCli.md)
- passed to `Deno.exit` in `main.ts`

## Members
| Member | Kind | Description |
|---|---|---|
| `Solved` = `0` | enum member | Solved (with `--all`: every level), or `--help` |
| `Failed` = `1` | enum member | Not solved or invalid (with `--all`: at least one level) |
| `Usage` = `2` | enum member | Bad flags, unknown level id, missing file |

## Example
```ts
Deno.exit(await run(Deno.args));   // an ExitCode
```

## Design notes
The one numeric enum in the project: its values are what the shell sees, the way other enums' string values are what the data files contain.
