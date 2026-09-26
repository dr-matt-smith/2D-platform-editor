# ParsedLevel

`packages/agent/src/ParsedLevel.ts` · interface

The part of a parsed level the agent reads. level-format's `Level` has these fields (and more), so it can be passed straight in. The same file defines `PickupRequired`: `'all'` or a count.

## Relationships
- taken by every planner, simulator and tester; wrapped by [LevelGrid](LevelGrid.md)
- passed on to [PhysicsAdapter](PhysicsAdapter.md)`.makeScene`

## Members
| Member | Kind | Description |
|---|---|---|
| `grid` | property | The rows of glyphs |
| `meta.width` | property | The declared width in cells |
| `meta.pickupRequired?` | property | `PickupRequired`: `'all'` (default) or how many pickups the exit needs (0 = none) |

## Example
```ts
PlannerFactory.create(jsAdapter).plan(Level.parse(text), legend.toRecord());
```

## Design notes
Structural typing at a package boundary: the agent names only the fields it needs, so it never imports level-format, yet level-format's richer type fits.
