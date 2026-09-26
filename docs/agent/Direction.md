# Direction

`packages/agent/src/Direction.ts` · enum

A horizontal direction.

## Relationships
- held by every [MoveAction](MoveAction.md) (`dir`); pressed by [PlanBuilder](PlanBuilder.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Left` | `'left'` | The left key |
| `Right` | `'right'` | The right key |

## Example
```ts
new JumpAction(Direction.Left, 26);
```

## Design notes
The values are the key names in a recording, so an action writes
`{ key: this.dir }` directly and the engine's scripted input understands it.
