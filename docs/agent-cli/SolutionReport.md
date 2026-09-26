# SolutionReport

`apps/agent-cli/src/LevelReport.ts` · interface

One winning solution in a [SolvedReport](SolvedReport.md), minus the planner's internal search graph.

## Relationships
- the `solutions` of a [SolvedReport](SolvedReport.md)
- built by [LevelSolver](LevelSolver.md) from the agent's `Solution`

## Members
| Member | Kind | Description |
|---|---|---|
| `stats` | property | The agent's `SolutionStats` (frames, steps, walks, jumps, drops, score, attempts) |
| `recording` | property | Frame-indexed key events; replay with the engine's `ScriptedInput` |
| `trace` | property | The planned steps, explained |
| `unreachable` | property | Optional goals the solution skipped |

## Example
```ts
const [best] = report.solutions;
jsAdapter.makeScriptedInput(best.recording);
```

## Design notes
Plain data; part of the JSON contract, so it copies only what a tool can use.
