# Aabb

`packages/engine/src/Aabb.ts` · class

Axis-aligned bounding-box collision tests. Stateless, so its helpers are
static methods.

## Relationships
- works on any [Box](Box.md) (every [Entity](Entity.md) is one)
- `resolveAxis` takes an [Axis](Axis.md)
- used by [Entity](Entity.md)`.overlaps` and [Player](Player.md)`.update`

## Members
| Member | Kind | Description |
|---|---|---|
| `overlaps(a, b)` | static method | Do the boxes overlap? Touching edges do not count |
| `resolveAxis(mover, solid, axis)` | static method | After `mover` moved along `axis`: the corrected coordinate that pushes it out of `solid` (on the side its centre is nearer), or `null` if they don't overlap |

## Example
```ts
Aabb.overlaps({ x: 0, y: 0, w: 20, h: 20 }, { x: 10, y: 10, w: 20, h: 20 }); // true
Aabb.resolveAxis({ x: 85, y: 100, w: 20, h: 20 }, { x: 100, y: 100, w: 20, h: 20 }, Axis.X); // 80
```

## Design notes
- **Static methods on a concept.** The tests hold no state, so there is
  nothing to construct; grouping them under `Aabb` names the idea they
  belong to (the constructor is private).
- **Accepts an interface.** Parameters are [Box](Box.md), so entities and
  plain objects both work.
- **Unchanged arithmetic.** The expressions are exactly the vendored ones —
  the golden parity vectors depend on them.
