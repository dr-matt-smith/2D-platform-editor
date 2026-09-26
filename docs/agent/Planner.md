# Planner

`packages/agent/src/Planner.ts` · abstract class

A strategy for finding a key recording that solves a level. Every planner
visits the goals (the required pickups, then an exit) one leg at a time and
writes a [Plan](Plan.md); the strategies differ in how a leg is searched.

## Relationships
- extended by [PerFramePlanner](PerFramePlanner.md) (default) and [BucketPlanner](BucketPlanner.md)
- made by [PlannerFactory](PlannerFactory.md) from a [PlannerKind](PlannerKind.md)
- holds a [PhysicsAdapter](PhysicsAdapter.md), checked by [AdapterGuard](AdapterGuard.md)
- used by [LevelTester](LevelTester.md); takes [PlanOptions](PlanOptions.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Planner(adapter)` | protected constructor | Checks the adapter; only subclasses construct |
| `adapter` | protected readonly property | The engine the planner simulates on |
| `kind` | abstract readonly property | Which [PlannerKind](PlannerKind.md) this is |
| `plan(parsed, legend, options?)` | abstract method | Plan a route; never null |
| `replan(previous, sim, parsed, legend, options?)` | method | Block the step that was running when the replay `sim` failed, and plan again. Null for an empty or missing plan |
| `describeGoal(goalKey, layout, otherPrefix)` | protected static method | "exit at (c,r)" / "pickup #n at (c,r)" for trace text |

## Example
```ts
const planner: Planner = PlannerFactory.create(jsAdapter, kind);
let plan = planner.plan(level, legend);
const sim = new Simulator(jsAdapter).run(level, legend, plan.recording);
if (sim.outcome !== SimOutcome.Won) plan = planner.replan(plan, sim, level, legend) ?? plan;
```

## Design notes
- **Strategy pattern.** Callers depend on the abstract `Planner`; the
  concrete strategy is chosen once, at construction. Adding a third
  strategy means a new subclass and one line in the factory.
- **Template method.** `replan` is concrete: it works out what to block and
  then calls the abstract `plan`, which each strategy supplies.
- **Abstract property.** `kind` is declared abstract, so every strategy
  must say what it is, and TypeScript enforces it.
