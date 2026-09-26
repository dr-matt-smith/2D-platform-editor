# DrawSpec

`packages/render/src/DrawSpec.ts` · class

The part of an image to draw into one cell: `image` cropped to the source
rectangle `(sx, sy, sw, sh)`. A sprite sheet uses it to draw one frame of a
strip; a plain image uses the whole area (`DrawSpec.whole`).

## Relationships
- implements [Sprite](Sprite.md) — a still sprite whose `frameAt` ignores the time
- returned by every [Tileset](Tileset.md) / [RenderTileset](RenderTileset.md) sprite method
- made by [SpriteStrip](SpriteStrip.md)`.frame` (and so by [SpriteAnimation](SpriteAnimation.md))
- drawn by [LevelRenderer](LevelRenderer.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new DrawSpec(image, sx, sy, sw, sh)` | constructor | An image and a source rectangle in its pixels |
| `image`, `sx`, `sy`, `sw`, `sh` | readonly properties | As given |
| `whole(image)` | static method | The whole image: `(0, 0, width, height)` |
| `frameAt(now?)` | method | Returns itself |
| `draw(ctx, x, y, size)` | method | `ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size)` |

## Example
```ts
const frame3 = new DrawSpec(strip, 3 * 32, 0, 32, 32);
frame3.draw(ctx, 48, 24, 24);    // one 32-px frame scaled into a 24-px cell
```

## Design notes
- **Immutable value object** with `readonly` constructor parameters.
- **Behaviour with its data.** Drawing lives here, so the renderer and the
  playtest overlay make the same nine-argument `drawImage` call.
- **A still image is a sprite too.** Implementing [Sprite](Sprite.md) with
  `frameAt` returning `this` lets code treat still and animated sprites alike.
