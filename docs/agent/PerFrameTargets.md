# PerFrameTargets

`packages/agent/src/PerFrameExpander.ts` · interface

The targets a [PerFrameExpander](PerFrameExpander.md) checks edges against.

## Relationships
- taken by the [PerFrameExpander](PerFrameExpander.md) constructor

## Members
| Member | Kind | Description |
|---|---|---|
| `exitCells?` | property | Exits, for spotting edges that win on the way |
| `precisionTargets?` | property | Pickups and exits, for precision landings |

## Example
```ts
new PerFrameExpander(jsAdapter, level, legend, null, { exitCells, precisionTargets: [...pickupCells, ...exitCells] });
```

## Design notes
Without precision targets the expander skips recording trajectories, which is faster.
