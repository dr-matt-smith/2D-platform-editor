# Coin

`packages/engine/src/Coin.ts` · class

A pickup. The playtest collects it when the player overlaps it; collecting
enough of them unlocks the exit.

## Relationships
- extends [Entity](Entity.md)
- built by [World](World.md) from cells whose role is `pickup`
- collected by [PlaytestScene](PlaytestScene.md), which then plays [Sound](Sound.md)`.Coin`

## Members
| Member | Kind | Description |
|---|---|---|
| `new Coin(x, y)` | constructor | A tile-sized, uncollected coin |
| `collected` | property | Has it been picked up? Writable: the agent resets it when it rewinds |
| `collect()` | method | Mark it collected |
| `draw(ctx)` | method | A filled circle, or nothing once collected |

## Example
```ts
for (const coin of world.coins) {
  if (!coin.collected && player.overlaps(coin)) coin.collect();
}
```

## Design notes
A collected coin stays in the world's list rather than being removed, so
the level's total stays fixed for the win rule and a restart is just a
rebuild. The object hides its own drawing when collected, so callers never
need to check.
