# PerFramePlanner

`packages/agent/src/PerFramePlanner.ts` · class

The default planning strategy. A* nodes carry the player's exact physics
state, and edges are made on demand by simulating actions from that state,
so the plan replays on the engine exactly as predicted.

## Relationships
- extends [Planner](Planner.md); its kind is [PlannerKind](PlannerKind.md)`.PerFrame`
- uses a [PerFrameExpander](PerFrameExpander.md) per plan, and [StateCluster](StateCluster.md) for node identity
- reads the level through [LevelGrid](LevelGrid.md); writes with a [PlanBuilder](PlanBuilder.md)
- tuned by [PerFramePlannerOptions](PerFramePlannerOptions.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new PerFramePlanner(adapter, options?)` | constructor | `options.tol` (cluster tolerance), `options.nodeCap` (default 100 000) |
| `kind` | readonly property | `PlannerKind.PerFrame` |
| `stepId(from, edge)` | static method | The id "fromR,fromC>toR,toC:kind" of a step, as used in `blocked` and `TraceEntry.edgeId` |
| `plan(parsed, legend, options?)` | method | Nearest-first pickups, then the exit; one A* per leg, never taking a step in `options.blocked` |
| `findPath(expander, fromState, goalCellKey)` | method | A* from an exact state to any state in the cell "r,c"; the [PerFrameStep](PerFrameStep.md)s, `[]` if already there, or null if the node cap runs out |
| `DEFAULT_NODE_CAP` | static readonly | 100 000 |

## Example
```ts
const planner = new PerFramePlanner(jsAdapter, { nodeCap: 20_000 });
const plan = planner.plan(level, legend);
```

## Design notes
- **No bucketing.** Each edge ends in an exact state and the next search
  starts from it, so the recording's timings are exact by construction.
  Near-identical states are merged by [StateCluster](StateCluster.md) so
  the search stays finite.
- **Deterministic ties.** Edges are sorted by the action's `sortKey`
  before relaxing, and the open set is scanned in insertion order, so two
  runs always pick the same plan. That determinism is what the golden
  vectors check.
- **Different release rules from the bucket planner.** When writing a leg,
  every action releases its direction exactly when the simulated action
  did (including drops and run-offs), because the chain is exact.
- **Step ids name a move between two cells.** `stepId(from, edge)` gives
  "fromR,fromC>toR,toC:kind" — the same "from>to:kind" shape as the bucket
  planner's ids. Blocking an id rules out that kind of move between those
  cells, so the search must find another way; that is how LevelTester
  finds alternative routes and how `replan` works around a failed step.
  With nothing blocked the search is exactly as before, which keeps the
  golden vectors unchanged.
- When the exit is unreachable it returns the plan so far *without* a
  final key release (the bucket planner adds one); both are kept exactly
  as they were.
