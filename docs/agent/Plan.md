# Plan

`packages/agent/src/Plan.ts` · class

A planner's answer for a level: the key [Recording](RecordingEvent.md) to
replay, the explained steps behind it ([TraceEntry](TraceEntry.md)), and
what could not be reached. A plan is never null; when even the exit is out
of reach its trace is empty and `unreachable` says why.

## Relationships
- built by [PlanBuilder](PlanBuilder.md) (or `Plan.empty`) for a [Planner](Planner.md)
- implements [PlanData](PlanData.md); holds [PlanStats](PlanStats.md), [UnreachableGoal](UnreachableGoal.md)s and a [LevelLayout](LevelLayout.md)
- held by [Solution](Solution.md) and [LevelTestFailure](LevelTestFailure.md); drawn by the editor's path overlay

## Members
| Member | Kind | Description |
|---|---|---|
| `new Plan(data)` | constructor | From a [PlanData](PlanData.md) |
| `empty(graph)` | static method | A plan with no steps |
| `trace`, `recording`, `stats` | readonly properties | The steps, the key events, the counts |
| `graph` | readonly property | The [LevelLayout](LevelLayout.md) (the bucket planner's whole [NavGraph](NavGraph.md)); null if the per-frame planner found no spawn or exit |
| `goals` | readonly property | Goals in visit order as "r,c"; the last is the exit |
| `unreachable` | readonly property | Goals with no path |
| `isEmpty` | get accessor | No steps? |
| `stepAtFrame(frame)` | method | The step running at `frame` (the last step after the end) |
| `stepsToBlock(blocked)` | method | Step ids not already blocked, longest step first — the variations LevelTester tries |
| `routeKey()` | method | The step ids in order, as one string: equal keys mean the same route |
| `hasSameRecordingAs(other)` | method | Same key events at the same frames? |
| `recordingKey()` | method | The recording as one string, for de-duplicating |

## Example
```ts
const plan = planner.plan(level, legend);
if (plan.isEmpty) console.log(plan.unreachable);
for (const step of plan.trace) console.log(step.frameRange, step.why);
```

## Design notes
- **Behaviour next to the data.** The questions the tester asks of a plan
  ("which step failed?", "which step to block?", "have I seen this
  recording?") are methods on the plan rather than helpers in the tester.
- **Named `graph` for compatibility.** The editor's overlay reads
  `plan.graph.start`; the type is the narrower [LevelLayout](LevelLayout.md)
  interface, which [NavGraph](NavGraph.md) implements.
