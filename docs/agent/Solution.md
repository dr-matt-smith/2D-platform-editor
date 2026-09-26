# Solution

`packages/agent/src/Solution.ts` · class

A [Plan](Plan.md) whose recording won a headless replay, with the numbers
the editor's dialog and the CLI show.

## Relationships
- created by [LevelTester](LevelTester.md) through `Solution.fromWin`
- holds a [Plan](Plan.md) and [SolutionStats](SolutionStats.md)
- listed in a [LevelTestSuccess](LevelTestSuccess.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `fromWin(plan, sim, attempt)` | static method | The solution a plan became when its replay ([SimResult](SimResult.md)) won on attempt `attempt` |
| `plan` | readonly property | The winning [Plan](Plan.md) (its trace explains the route) |
| `recording` | readonly property | The key events to replay (the plan's recording) |
| `stats` | readonly property | [SolutionStats](SolutionStats.md): step counts, attempt, winning frame, score |
| `unreachable` | readonly property | Goals the plan skipped (optional pickups) |

## Example
```ts
const best = result.ok ? result.solution : null;
console.log(`${best?.stats.frame} frames, ${best?.stats.jumps} jumps`);
```

## Design notes
A static factory names *how* a solution comes to exist (a win), and the
private constructor keeps anyone from making one without a replay behind
it. The stats object keeps its key order because it appears in the CLI's
JSON output.
