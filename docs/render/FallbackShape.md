# FallbackShape

`packages/render/src/FallbackShape.ts` · enum

The shape drawn for a glyph that has no sprite.

## Relationships
- the `shape` of a [FallbackStyle](FallbackStyle.md); chosen per glyph by [Palette](Palette.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `Block` = `'block'` | enum member | Fills the whole cell (terrain, exit) |
| `Spike` = `'spike'` | enum member | A triangle pointing up (hazard) |
| `Disc` = `'disc'` | enum member | A large circle (player) |
| `Pip` = `'pip'` | enum member | A small circle (pickup) |

## Example
```ts
if (style.shape === FallbackShape.Spike) { /* … */ }
```

## Design notes
A string enum for a fixed set of values; the values are the names the
shapes had before the restructure.
