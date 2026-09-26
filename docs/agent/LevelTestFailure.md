# LevelTestFailure

`packages/agent/src/LevelTestResult.ts` · interface

No solution was found.

## Relationships
- one side of [LevelTestResult](LevelTestResult.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `ok` | property | `false` |
| `lastPlan` | property | The last [Plan](Plan.md) tried; its `unreachable` explains a blocked exit |
| `lastSim` | property | How the last replay ended ([SimResult](SimResult.md)), if any |
| `attempts` | property | Replays tried |
| `reason?` | property | A [FailureReason](FailureReason.md), when the test stopped early |

## Example
```ts
if (!result.ok && result.lastSim?.outcome === SimOutcome.Dead) console.log('died at', result.lastSim.pos);
```

## Design notes
Carries enough to explain the failure: the editor dialog and `describeFailure` in the CLI build their messages from it.
