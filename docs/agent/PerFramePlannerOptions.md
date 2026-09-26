# PerFramePlannerOptions

`packages/agent/src/PerFramePlanner.ts` · interface

Tuning for [PerFramePlanner](PerFramePlanner.md).

## Relationships
- taken by the [PerFramePlanner](PerFramePlanner.md) constructor

## Members
| Member | Kind | Description |
|---|---|---|
| `tol?` | property | A [ClusterTolerance](ClusterTolerance.md) (default `StateCluster.DEFAULT_TOLERANCE`) |
| `nodeCap?` | property | Give up on a leg after this many expansions (default 100 000) |

## Example
```ts
new PerFramePlanner(jsAdapter, { nodeCap: 20_000 });
```

## Design notes
Strategy-specific settings belong to the strategy object, so the shared `plan` signature stays the same for every planner.
