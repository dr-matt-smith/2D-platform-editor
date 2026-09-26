# NavEdge

`packages/agent/src/NavGraph.ts` · interface

A simulated action from one [NavGraph](NavGraph.md) node to another.

## Relationships
- held in [NavGraph](NavGraph.md)`.edges`; wrapped by [NavPathStep](NavPathStep.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `to` | property | Destination StateKey text |
| `kind`, `dir`, `action` | properties | The [MoveAction](MoveAction.md) taken |
| `cost` | property | Frames |
| `recording` | property | The action's key events from frame 0 |
| `endPos`, `endVel`, `endState` | properties | Where the action ended when simulated |
| `isWinEdge` | property | Ends on an exit |
| `precision?` | property | A precision-landing edge |

## Example
```ts
for (const e of graph.edgesFrom('1,1,0,L')) console.log(e.kind, e.dir, '→', e.to);
```

## Design notes
Carries the exact end state even though the destination is a bucket, so the bucket planner can re-simulate from real states.
