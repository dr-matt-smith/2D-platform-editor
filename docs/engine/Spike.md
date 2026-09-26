# Spike

`packages/engine/src/Spike.ts` · class

A lethal hazard: touching it ends the run.

## Relationships
- extends [Entity](Entity.md)
- built by [World](World.md) from cells whose role is `hazard`
- checked by [PlaytestScene](PlaytestScene.md), which sets [GamePhase](GamePhase.md)`.Dead`

## Members
| Member | Kind | Description |
|---|---|---|
| `new Spike(x, y)` | constructor | A tile-sized hazard |
| `draw(ctx)` | method | A filled triangle |

## Example
```ts
if (world.spikes.some((s) => player.overlaps(s))) phase = GamePhase.Dead;
```

## Design notes
The hit box is the whole tile, deliberately more generous than the
triangle it is drawn as. The subclass only adds a look; everything else is
inherited from [Entity](Entity.md).
