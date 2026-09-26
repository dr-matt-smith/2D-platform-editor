# PlanOptions

`packages/agent/src/Planner.ts` · interface

Options for one call to [Planner](Planner.md)`.plan`.

## Relationships
- taken by [Planner](Planner.md)`.plan` / `.replan`

## Members
| Member | Kind | Description |
|---|---|---|
| `tileset?` | property | Passed to the adapter's `makeScene`; opaque to the agent |
| `blocked?` | property | Edge ids ("from>to:kind") the plan must not use (the per-frame planner ignores it) |

## Example
```ts
planner.plan(level, legend, { blocked: new Set([plan.trace[0].edgeId]) });
```

## Design notes
Per-call options stay here; per-strategy tuning lives in the strategy's constructor ([PerFramePlannerOptions](PerFramePlannerOptions.md)).
