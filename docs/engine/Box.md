# Box

`packages/engine/src/Box.ts` · interface

Any axis-aligned box: top-left corner plus size, in world pixels.

## Relationships
- implemented by [Entity](Entity.md) (so by every entity)
- taken by [Aabb](Aabb.md); `solids` in [UpdateContext](UpdateContext.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | Top-left corner |
| `w`, `h` | properties | Width and height |

## Example
```ts
const probe: Box = { x: 35, y: 45, w: 10, h: 10 };
player.overlaps(probe);
```

## Design notes
Collision code asks for this interface, not for an `Entity`, so tests and
callers can pass plain objects. (level-format's `Rect` is a different
thing: a rectangle of grid *cells* for the editor's tools.)
