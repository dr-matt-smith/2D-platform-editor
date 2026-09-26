# ActionKind

`packages/agent/src/ActionKind.ts` · enum

The kinds of action the player can execute.

## Relationships
- each [Action](Action.md) subclass reports one as its `kind`
- stored in [TraceEntry](TraceEntry.md)`.kind`, [NavEdge](NavEdge.md) and [PerFrameEdge](PerFrameEdge.md); counted by [PlanBuilder](PlanBuilder.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Walk` | `'walk'` | [WalkAction](WalkAction.md) |
| `Jump` | `'jump'` | [JumpAction](JumpAction.md) |
| `Drop` | `'drop'` | [DropAction](DropAction.md) |
| `DropRelease` | `'drop_release'` | [DropReleaseAction](DropReleaseAction.md) |
| `RunOff` | `'run_off'` | [RunOffAction](RunOffAction.md) |
| `Wait` | `'wait'` | [WaitAction](WaitAction.md) |

## Example
```ts
const jumps = plan.trace.filter((t) => t.kind === ActionKind.Jump).length;
```

## Design notes
The values appear in traces, edge ids ("from>to:kind"), the "why" text
and the CLI's JSON output, so they never change. Code that needs an
action's parameters uses `instanceof` on the class rather than the kind.
