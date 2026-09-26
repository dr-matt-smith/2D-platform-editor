# BucketPlanner

`packages/agent/src/BucketPlanner.ts` · class

The older planning strategy, kept for diagnostics: build the whole
[NavGraph](NavGraph.md) of bucketed states up front, order the pickups
with [PickupTour](PickupTour.md), then A* each leg over the graph.

## Relationships
- extends [Planner](Planner.md); its kind is [PlannerKind](PlannerKind.md)`.Bucket`
- builds a [NavGraph](NavGraph.md) and returns it as the plan's `graph`
- re-simulates each step with an [ActionSimulator](ActionSimulator.md); writes with a [PlanBuilder](PlanBuilder.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new BucketPlanner(adapter)` | constructor | Checks the adapter |
| `kind` | readonly property | `PlannerKind.Bucket` |
| `plan(parsed, legend, options?)` | method | Plan over the NavGraph, avoiding any `options.blocked` edge ids |

## Example
```ts
const planner = PlannerFactory.create(jsAdapter, PlannerKind.Bucket);
const plan = planner.plan(level, legend, { blocked: new Set([someEdgeId]) });
```

## Design notes
- **Buckets are approximate, so it checks as it writes.** Each step is
  re-simulated from the player's real end state: the real cost sets the
  recording's timing, and if the player has drifted into a different
  bucket than the path assumed, it searches again from the live position
  (at most 48 steps per goal).
- **Blocking works.** Edge ids name both states ("r,c,vx,xo>r,c,vx,xo:kind"),
  so a [LevelTester](LevelTester.md) can block one edge and get a genuinely
  different route — the bucket planner can find several solutions.
- **Same interface, different internals.** From the outside it is just a
  [Planner](Planner.md); the NavGraph, the tour and the re-simulation are
  private details.
