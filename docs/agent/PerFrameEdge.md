# PerFrameEdge

`packages/agent/src/PerFrameExpander.ts` · interface

An edge found by expanding an exact state; it carries the exact destination state.

## Relationships
- returned by [PerFrameExpander](PerFrameExpander.md)`.expand`; held by [PerFrameStep](PerFrameStep.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `toCell` | property | The destination [Cell](Cell.md) |
| `toState` | property | The exact destination [PlayerState](PlayerState.md) (the same object as `endState`) |
| `kind`, `dir`, `action` | properties | The [MoveAction](MoveAction.md) taken |
| `cost` | property | Frames |
| `recording` | property | The action's key events from frame 0 |
| `endPos`, `endVel`, `endState` | properties | Where the action ended |
| `isWinEdge` | property | Touched an exit on the way |
| `precision?` | property | A precision-landing edge |

## Example
```ts
const cheapest = expander.expand(state).sort((a, b) => a.cost - b.cost)[0];
```

## Design notes
Unlike a [NavEdge](NavEdge.md), the destination is an exact state, not a bucket.
