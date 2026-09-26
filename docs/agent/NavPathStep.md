# NavPathStep

`packages/agent/src/NavGraph.ts` · interface

One step of a [NavGraph](NavGraph.md) path.

## Relationships
- returned (as a list) by [NavGraph](NavGraph.md)`.findPath`

## Members
| Member | Kind | Description |
|---|---|---|
| `from` | property | The StateKey text the step left |
| `edge` | property | The [NavEdge](NavEdge.md) taken |

## Example
```ts
const ids = path.map((s) => `${s.from}>${s.edge.to}:${s.edge.kind}`);
```

## Design notes
`from` plus the edge give the step's edge id, which is what a replan blocks.
