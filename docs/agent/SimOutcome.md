# SimOutcome

`packages/agent/src/SimOutcome.ts` · enum

How a replayed recording ended.

## Relationships
- the `outcome` of a [SimResult](SimResult.md) from [Simulator](Simulator.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Won` | `'won'` | Reached an exit with enough pickups |
| `Dead` | `'dead'` | Touched a hazard or fell out of the level |
| `Timeout` | `'timeout'` | The frame budget ran out first |

## Example
```ts
if (sim.outcome === SimOutcome.Won) keep(plan);
```

## Design notes
The CLI prints `lastSim` as JSON, so the values never change.
