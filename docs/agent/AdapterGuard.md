# AdapterGuard

`packages/agent/src/AdapterGuard.ts` · class

Checks a [PhysicsAdapter](PhysicsAdapter.md) at the agent's public
boundary: it must exist, and its `TILE` must equal the agent's.

## Relationships
- called by the [Planner](Planner.md) constructor (so by [PlannerFactory](PlannerFactory.md) and [LevelTester](LevelTester.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `assert(adapter, where)` | static method | Throws "`where`: an adapter is required…" or "…does not match the agent's TILE…"; narrows `adapter` to `PhysicsAdapter` |

## Example
```ts
AdapterGuard.assert(adapter, 'MyTool'); // throws for a missing or mismatched adapter
```

## Design notes
- **Fail loudly, early.** The agent cuts levels into cells at its own
  TILE. An adapter wrapping an engine with a different tile size (say a
  port that shipped the display tile size of 24) would make every edge
  land on the wrong cell and plans fail silently on the live engine.
- **A TypeScript assertion signature.** `asserts adapter is PhysicsAdapter`
  tells the compiler the value is safe after the call.
- It accepts `null` and `undefined` on purpose: the agent can be called
  from untyped JavaScript or through a bridge.
