# Axis

`packages/engine/src/Axis.ts` · enum

One of the two directions a box moves along.

## Relationships
- taken by [Aabb](Aabb.md)`.resolveAxis`; [Player](Player.md) resolves `X`

## Members
| Member | Value | Meaning |
|---|---|---|
| `X` | `'x'` | Horizontal |
| `Y` | `'y'` | Vertical |

## Example
```ts
const x = Aabb.resolveAxis(player, wall, Axis.X);
```

## Design notes
The player moves and resolves collisions one axis at a time; naming the
axis makes that visible at the call site.
