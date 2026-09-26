# Palette

`packages/render/src/Palette.ts` · class

The renderer's fixed colours: the sky behind every level, the HUD band's
default colours, and the fallback shape for each Dirt glyph.

## Relationships
- holds a [FallbackStyle](FallbackStyle.md) per glyph (`#`, `^`, `P`, `o`, `E`)
- used by [LevelRenderer](LevelRenderer.md) (sky fill, HUD defaults, fallback shapes)
- its glyph colours are repeated as legend swatches in the Dirt `tile_lookup.json`; `Palette.test.ts` checks they match

## Members
| Member | Kind | Description |
|---|---|---|
| `SKY` | static readonly | `'#1b2a3a'` — painted behind every level |
| `HUD_BACKGROUND` | static readonly | `'#252526'` — HUD band colour when the page sets no `--hud-bg` |
| `HUD_TEXT` | static readonly | `'#ececec'` — HUD text colour when the page sets no `--hud-fg` |
| `fallbackFor(glyph)` | static method | The glyph's [FallbackStyle](FallbackStyle.md), or `null` |

| Glyph | Colour | [FallbackShape](FallbackShape.md) |
|---|---|---|
| `#` | `#6b4a2f` | `Block` |
| `^` | `#c0392b` | `Spike` |
| `P` | `#3498db` | `Disc` |
| `o` | `#f1c40f` | `Pip` |
| `E` | `#2ecc71` | `Block` |

## Example
```ts
Palette.fallbackFor('P')?.draw(ctx, x, y, 24);   // the blue player disc
Palette.fallbackFor('Z');                        // null — nothing to draw
```

## Design notes
- **A class of static members** with a private constructor: there is one
  palette, and grouping the constants under a name (`Palette.SKY`) says
  where they belong better than loose exports.
- **Lookup returns an object with behaviour.** `fallbackFor` hands back a
  [FallbackStyle](FallbackStyle.md) that can draw itself, so callers never
  switch on the shape.
