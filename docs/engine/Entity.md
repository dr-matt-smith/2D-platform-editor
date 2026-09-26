# Entity

`packages/engine/src/Entity.ts` · abstract class

Anything that exists in the game world: an axis-aligned box that can update
itself each frame and draw itself. The base of the engine's one real
inheritance hierarchy.

## Relationships
- implements [Box](Box.md), so any entity can be passed to [Aabb](Aabb.md)
- extended by [Player](Player.md), [Platform](Platform.md), [Coin](Coin.md), [Spike](Spike.md) and [Goal](Goal.md)
- `update` takes an [UpdateContext](UpdateContext.md); `centre` returns a [Point](Point.md)
- held, one list per kind, by [World](World.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Entity(x, y, w, h)` | protected constructor | Only subclasses construct entities |
| `x`, `y` | properties | Top-left corner in world pixels. Writable: the player moves, and the agent sets its pose |
| `w`, `h` | readonly properties | Size in world pixels |
| `bounds` | get accessor | A copy of the box as a plain [Box](Box.md) |
| `centre` | get accessor | The centre of the box, a [Point](Point.md) |
| `overlaps(other)` | method | Does this entity's box overlap `other`? (via [Aabb](Aabb.md)`.overlaps`) |
| `update(dt, context)` | method | Advance one frame. Does nothing by default; [Player](Player.md) overrides it |
| `draw(ctx)` | abstract method | Draw the entity as a simple shape at its world position |

## Example
```ts
import { World } from '@2d-platform/engine';

// Every entity draws itself; the loop doesn't know the kinds.
for (const entity of World.fromLevel(level).entities) entity.draw(ctx);
```

## Design notes
- **Inheritance for a true "is-a" family.** A player, a platform and a coin
  all *are* boxes in the world, with the same position, size and overlap
  test. That shared structure lives once, in the base class.
- **Abstract method vs. default method.** `draw` is abstract because every
  kind of entity must decide how it looks. `update` has a do-nothing default
  because only the player moves — the others inherit "stay still".
- **Polymorphism.** `World.draw` calls `entity.draw(ctx)` on a mixed list and
  each object runs its own version. Adding a new kind of entity means adding
  a subclass, not editing the loop.
- **Protected constructor.** `new Entity(...)` makes no sense on its own; the
  constructor is `protected` so only subclasses can call it (the class is
  also `abstract`, which TypeScript already enforces).
- **Where drawing really happens.** The playtest draws through the shared
  `LevelRenderer` (render package) so play matches the editor preview.
  `Entity.draw` is the engine's own tileset-free view, used by
  [World](World.md)`.draw`.
