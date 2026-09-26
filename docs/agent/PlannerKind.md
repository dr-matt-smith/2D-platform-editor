# PlannerKind

`packages/agent/src/PlannerKind.ts` · enum

Which planning strategy to use.

## Relationships
- mapped to a class by [PlannerFactory](PlannerFactory.md); reported by [Planner](Planner.md)`.kind`
- taken by [LevelTester](LevelTester.md)`.create`

## Members
| Member | Value | Meaning |
|---|---|---|
| `PerFrame` | `'perframe'` | [PerFramePlanner](PerFramePlanner.md): exact states, edges on demand (default) |
| `Bucket` | `'bucket'` | [BucketPlanner](BucketPlanner.md): a prebuilt bucketed graph (diagnostics) |

## Example
```ts
LevelTester.create(jsAdapter, PlannerKind.Bucket);
```

## Design notes
Replaces a `planner?: 'perframe' | 'bucket'` string option that `plan()`
switched on. The strategy is now chosen once, when the planner is made.
