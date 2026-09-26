# ClusterTolerance

`packages/agent/src/StateCluster.ts` · interface

How close two states must be to count as one A* node.

## Relationships
- taken by [StateCluster](StateCluster.md); set through [PerFramePlannerOptions](PerFramePlannerOptions.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | readonly properties | Position tolerance, px |
| `vx`, `vy` | readonly properties | Speed tolerance, px/s |

## Example
```ts
StateCluster.nearby(a, b, { x: 0.1, y: 0.5, vx: 5, vy: 5 });
```

## Design notes
Readonly fields, and the default is frozen, so a tolerance can be shared safely.
