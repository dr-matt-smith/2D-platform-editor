# LevelSolver

`apps/agent-cli/src/LevelSolver.ts` · class

Validates a level, runs the planning agent on it, and sums up the outcome as a report ([SolvedReport](SolvedReport.md), [UnsolvedReport](UnsolvedReport.md) or [InvalidReport](InvalidReport.md)). No I/O and no formatting.

## Relationships
- holds the agent's `PhysicsAdapter` (default: the engine's `jsAdapter`)
- uses level-format's `LevelValidator` and the agent's `LevelTester`
- takes a [PreparedLevel](PreparedLevel.md); returns a `LevelReport` with a [LevelInfo](LevelInfo.md) and [SolutionReport](SolutionReport.md)s
- made by [AgentCommand](AgentCommand.md)`.solver()`

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelSolver(adapter?)` | constructor | The engine the agent simulates on |
| `solve(level, budgetMs)` | async method | Invalid levels are reported without running the agent; an unknown-tileset warning is listed first |
| `describeFailure(result, parsed)` | static method | A failed search as sentences, most important first (timeout, unreachable goals as file line/col, how the last replay ended) |

## Example
```ts
const report = await new LevelSolver().solve(level, 5000);
if (report.status === ReportStatus.Solved) report.solutions[0].recording;   // replayable
```

## Design notes
- **Depends on an interface.** The solver takes a `PhysicsAdapter`, the
  agent's contract, not the engine; the default is simply the one engine
  this repo has.
- **Pure transformation.** In: a prepared level. Out: plain data. Whether
  that data becomes text or JSON is someone else's job
  ([ReportFormatter](ReportFormatter.md)), which keeps both sides small.
- **Enums instead of strings.** Outcomes are compared against the agent's
  `FailureReason`, `GoalKind` and `SimOutcome` enums, and reports carry a
  [ReportStatus](ReportStatus.md).
