# Goal

`packages/engine/src/Goal.ts` · class

The level exit. Touching it wins once the level's pickup rule is met.

## Relationships
- extends [Entity](Entity.md)
- built by [World](World.md) from cells whose role is `exit`
- checked by [PlaytestScene](PlaytestScene.md), which sets [GamePhase](GamePhase.md)`.Won`

## Members
| Member | Kind | Description |
|---|---|---|
| `new Goal(x, y)` | constructor | A tile-sized exit |
| `draw(ctx)` | method | A framed doorway in the accent colour |

## Example
```ts
if (rule.isMetBy(score, total) && world.goals.some((g) => player.overlaps(g))) {
  phase = GamePhase.Won;
}
```

## Design notes
Not part of the vendored engine (the original won when every coin was
collected); added as one more subclass without touching the others.
