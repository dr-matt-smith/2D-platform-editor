# PerFrameStep

`packages/agent/src/PerFrameExpander.ts` · interface

One step of a per-frame path.

## Relationships
- returned (as a list) by [PerFramePlanner](PerFramePlanner.md)`.findPath`

## Members
| Member | Kind | Description |
|---|---|---|
| `from` | property | The [StateCluster](StateCluster.md) key the step left |
| `edge` | property | The [PerFrameEdge](PerFrameEdge.md) taken |
| `fromState` | property | The exact state the step started from |

## Example
```ts
for (const step of path) console.log(step.fromState.x, '→', step.edge.toState.x);
```

## Design notes
Each step's `fromState` is the previous step's `edge.toState`: the chain is exact.
