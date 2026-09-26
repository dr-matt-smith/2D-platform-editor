# PlannerFactory

`packages/agent/src/PlannerFactory.ts` · class

Makes the [Planner](Planner.md) for a [PlannerKind](PlannerKind.md).

## Relationships
- creates [PerFramePlanner](PerFramePlanner.md) and [BucketPlanner](BucketPlanner.md)
- used by [LevelTester](LevelTester.md), `packages/agent-py/tools/gen_golden.ts` and the tests

## Members
| Member | Kind | Description |
|---|---|---|
| `create(adapter, kind?)` | static method | A planner of `kind` (default `DEFAULT_KIND`) driving `adapter` |
| `DEFAULT_KIND` | static readonly | `PlannerKind.PerFrame` |

## Example
```ts
const planner = PlannerFactory.create(jsAdapter);                     // per-frame
const bucket = PlannerFactory.create(jsAdapter, PlannerKind.Bucket);
```

## Design notes
- **Factory method.** Callers name *what* they want (a kind) and get back
  the abstract type; which class that is stays the factory's business.
- **Why not `Planner.create`?** The subclasses import `Planner` in order to
  extend it. If `Planner.ts` imported them back for a factory, the modules
  would load in a cycle and a subclass could be evaluated before its base
  class exists. A separate factory keeps the imports one-way.
- The `switch` over the enum is exhaustive, so TypeScript flags a new
  `PlannerKind` that has no case.
