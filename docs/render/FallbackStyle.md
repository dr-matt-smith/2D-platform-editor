# FallbackStyle

`packages/render/src/FallbackStyle.ts` · class

How to draw a glyph without an image: a colour and a
[FallbackShape](FallbackShape.md). Used when a tileset has no sprite for a
glyph (the Dirt tileset draws its player, hazard, pickup and exit this way)
or no tileset has loaded.

## Relationships
- has a [FallbackShape](FallbackShape.md)
- held by [Palette](Palette.md), one per glyph
- drawn by [LevelRenderer](LevelRenderer.md)`.drawFallback`

## Members
| Member | Kind | Description |
|---|---|---|
| `new FallbackStyle(color, shape)` | constructor | A CSS colour and a shape |
| `color` | readonly property | Fill colour |
| `shape` | readonly property | The [FallbackShape](FallbackShape.md) |
| `draw(ctx, x, y, size)` | method | Fill the shape into the `size`-px cell at (x, y) |

| Shape | Drawn as |
|---|---|
| `Block` | the whole cell |
| `Spike` | a triangle from the bottom corners to the top middle |
| `Disc` | a centred circle, radius 0.4 × size |
| `Pip` | a centred circle, radius 0.18 × size |

## Example
```ts
new FallbackStyle('#c0392b', FallbackShape.Spike).draw(ctx, 0, 0, 24);
```

## Design notes
**Behaviour next to its data.** The colour, the shape and how to draw them
are one small immutable object; the `switch` over the shape enum lives in
one place instead of in the renderer.
