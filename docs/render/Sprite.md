# Sprite

`packages/render/src/Sprite.ts` · interface

Something that can say what to draw at a given moment. A still image
ignores the time; an animation picks a frame from it.

## Relationships
- implemented by [DrawSpec](DrawSpec.md) (still) and [SpriteAnimation](SpriteAnimation.md) (animated)
- created by [SpriteStrip](SpriteStrip.md)`.toSprite` and [TilesetDirectory](TilesetDirectory.md)`.sprite`
- stored by [Tileset](Tileset.md), one per glyph and per terrain mask

## Members
| Member | Kind | Description |
|---|---|---|
| `frameAt(now?)` | method | The [DrawSpec](DrawSpec.md) to draw at `now` (ms); no `now` gives frame 0 |

## Example
```ts
const sprites: Sprite[] = [DrawSpec.whole(block), new SpriteStrip(idle, 11).toSprite()];
for (const s of sprites) s.frameAt(performance.now()).draw(ctx, x, y, 24);
```

## Design notes
**Polymorphism.** The tileset keeps one map of sprites and calls
`frameAt(now)` on each, never asking which kind it holds. Before the
restructure this was a union of "spec or function" checked with `typeof`;
an interface with two implementing classes says the same thing directly.
