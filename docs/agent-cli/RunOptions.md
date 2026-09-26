# RunOptions

`apps/agent-cli/src/RunOptions.ts` · interface

The options shared by every command that runs the agent.

## Relationships
- held by [AgentCommand](AgentCommand.md); filled in by [ArgParser](ArgParser.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `budgetMs` | property | `--budget`: search time per level (default 5000) |
| `json` | property | `--json`: print JSON instead of text |
| `contentDir` | property | `--content`: the folder holding `levels/` and `tilesets/` |

## Example
```ts
const options: RunOptions = { budgetMs: 8000, json: true, contentDir: 'content/data' };
```

## Design notes
A plain data shape, so an interface: it has no behaviour of its own.
