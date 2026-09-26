# SpriteStrip

`packages/render/src/SpriteStrip.ts` · class

An image holding a number of equal frames side by side (a horizontal sprite
strip). It cuts out single frames and decides, from a glyph's `frame` and
`fps` fields, whether the strip is shown still or animated.

## Relationships
- makes [DrawSpec](DrawSpec.md)s (`frame`) and [Sprite](Sprite.md)s (`toSprite`)
- owned by each [SpriteAnimation](SpriteAnimation.md) it creates
- used by [TilesetDirectory](TilesetDirectory.md)`.sprite`, fed from a [TilesetGlyphDef](TilesetGlyphDef.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_FPS` | static readonly | `10` — speed when the glyph gives no `fps` |
| `new SpriteStrip(image, frames?)` | constructor | `frames` below 1 or missing means 1. Warns (once) if the width does not divide evenly; the leftover right edge is never drawn |
| `image` | readonly property | The strip image |
| `frames` | readonly property | Number of frames (at least 1) |
| `frameWidth` | readonly property | `floor(image.width / frames)` |
| `frame(index)` | method | Frame `index` as a [DrawSpec](DrawSpec.md); a one-frame strip is the whole image |
| `toSprite(frame?, fps?)` | method | See the table below |

| Glyph fields | `toSprite` gives |
|---|---|
| one frame | the whole image, still |
| `frame: i` | frame `i`, still (out of range → frame 0) |
| `fps: 0` | frame 0, still |
| otherwise | a [SpriteAnimation](SpriteAnimation.md) at `fps` (default 10) |

## Example
```ts
const strip = new SpriteStrip(idleImage, 11);   // 352 × 32 → 32-px frames
strip.frame(2);                                 // DrawSpec(idleImage, 64, 0, 32, 32)
strip.toSprite();                               // SpriteAnimation at 10 fps
strip.toSprite(5);                              // DrawSpec, frame 5
```

## Design notes
- **A factory method returning an interface.** `toSprite` chooses which
  class to create; callers only see a [Sprite](Sprite.md).
- **Composition.** A [SpriteAnimation](SpriteAnimation.md) *has* a strip and
  asks it for frames, rather than repeating the frame arithmetic.
