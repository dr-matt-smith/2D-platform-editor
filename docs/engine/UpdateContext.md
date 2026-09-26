# UpdateContext

`packages/engine/src/UpdateContext.ts` · interface

What an [Entity](Entity.md) may read while it updates: the keys and the
solid boxes it must not pass through.

## Relationships
- passed to [Entity](Entity.md)`.update`; used by [Player](Player.md)
- holds an [InputSource](InputSource.md) and [Box](Box.md)es
- built each frame by [PlaytestScene](PlaytestScene.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `input` | property | The keys |
| `solids` | property | Boxes that block movement (the world's platforms) |

## Example
```ts
player.update(dt, { input: this.game.input, solids: world.platforms });
```

## Design notes
One parameter object gives every entity the same `update` signature (so
the method can be polymorphic) and hands the player only what it needs,
instead of the whole scene.
