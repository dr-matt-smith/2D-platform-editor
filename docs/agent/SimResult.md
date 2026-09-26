# SimResult

`packages/agent/src/Simulator.ts` · interface

The result of replaying a recording.

## Relationships
- returned by [Simulator](Simulator.md)`.run`; `outcome` is a [SimOutcome](SimOutcome.md)
- passed to [Planner](Planner.md)`.replan` and [Solution](Solution.md)`.fromWin`; `lastSim` of [LevelTestFailure](LevelTestFailure.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `outcome` | property | Won, dead or timeout |
| `frame` | property | The frame it ended on (the budget, for a timeout) |
| `score` | property | Pickups collected |
| `pos` | property | The player's final [Point](Point.md) |

## Example
```ts
const { outcome, frame } = new Simulator(jsAdapter).run(level, legend, recording);
```

## Design notes
Plain data: the CLI prints it as JSON, with this key order.
