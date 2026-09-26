# SweepTotals

`apps/agent-cli/src/SweepTotals.ts` · interface

The counts behind an `--all` sweep, as plain data: the `summary` object in the `--all --json` output.

## Relationships
- implemented by [SweepSummary](SweepSummary.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `total` | property | Levels in the sweep |
| `solved`, `unsolved`, `invalid` | properties | How many ended each way |
| `elapsedMs` | property | Search time summed over the levels the agent ran on |
| `failed` | property | Ids (or names) of the levels not solved |

## Example
```ts
const summary = new SweepSummary({ total: 2, solved: 2, unsolved: 0, invalid: 0, elapsedMs: 80, failed: [] });
```

## Design notes
The data half of [SweepSummary](SweepSummary.md): an interface for the shape, a class for the behaviour.
