# TraceEntry

`packages/agent/src/TraceEntry.ts` · interface

One explained step of a plan — what the editor's dialog lists and the CLI prints.

## Relationships
- written by [PlanBuilder](PlanBuilder.md)`.addStep`; listed in [Plan](Plan.md)`.trace`
- its `edgeId` is what [Planner](Planner.md)`.replan` and [LevelTester](LevelTester.md) block

## Members
| Member | Kind | Description |
|---|---|---|
| `kind` | property | The [ActionKind](ActionKind.md) |
| `target` | property | The [Cell](Cell.md) the step heads for |
| `why` | property | E.g. "jump right toward pickup #2 at (5,8)" |
| `frameRange` | property | `[start, end)` of the step within the recording |
| `edgeId` | property | "from>to:kind" |

## Example
```ts
for (const t of plan.trace) console.log(`${t.frameRange[0]}–${t.frameRange[1]} ${t.why}`);
```

## Design notes
Plain data, so it serialises to JSON as-is (the CLI's `--json` output) and keeps its key order.
