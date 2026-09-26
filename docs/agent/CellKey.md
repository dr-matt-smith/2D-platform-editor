# CellKey

`packages/agent/src/CellKey.ts` · class

The "r,c" text form of a [Cell](Cell.md). Plan goals are stored as cell
keys, and the searches use them as goal targets.

## Relationships
- used by the planners, [NavGraph](NavGraph.md) and [PickupTour](PickupTour.md)
- a [StateKey](StateKey.md)'s text starts with its cell key

## Members
| Member | Kind | Description |
|---|---|---|
| `of(r, c)` | static method | "r,c" |
| `parse(key)` | static method | The cell a key names (reads the first two parts, so a StateKey text works too) |

## Example
```ts
CellKey.of(3, 12);          // "3,12"
CellKey.parse('3,12,1,L');  // { r: 3, c: 12 }
```

## Design notes
A tiny static-only class: it gives the key format one definition instead
of template strings and `split(',')` scattered through the planners. The
constructor is private because there is nothing to instantiate.
