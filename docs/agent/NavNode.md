# NavNode

`packages/agent/src/NavGraph.ts` · interface

A [NavGraph](NavGraph.md) node: one (cell, speed bucket, x-offset bucket) state.

## Relationships
- extends [Cell](Cell.md); held in [NavGraph](NavGraph.md)`.nodes`, keyed by [StateKey](StateKey.md) text

## Members
| Member | Kind | Description |
|---|---|---|
| `r`, `c` | properties | The cell |
| `vxBucket` | property | -1, 0 or +1 |
| `xOffsetBucket` | property | An [XOffsetBucket](XOffsetBucket.md) |
| `supported` | property | Terrain under the cell? |

## Example
```ts
graph.nodes.get('1,2,0,L')?.supported;
```

## Design notes
Plain data: the graph owns the behaviour, nodes only describe states.
