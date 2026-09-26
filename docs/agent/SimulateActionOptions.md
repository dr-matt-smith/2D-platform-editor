# SimulateActionOptions

`packages/agent/src/ActionResult.ts` · interface

Options for [ActionSimulator](ActionSimulator.md)`.simulate`.

## Relationships
- taken by [ActionSimulator](ActionSimulator.md)`.simulate`

## Members
| Member | Kind | Description |
|---|---|---|
| `collectTrajectory?` | property | Record the position after every frame (for precision landings) |

## Example
```ts
simulator.simulate(state, action, { collectTrajectory: true }).trajectory;
```

## Design notes
Off by default: most simulations don't need the per-frame positions.
