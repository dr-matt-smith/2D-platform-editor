# Rect

`packages/level-format/src/Rect.ts` · class

A rectangle of grid cells, used by the editor's drag-to-fill and
drag-to-outline tools. Painting is pure: it returns a new grid.

## Relationships
- used by the editor to paint a [Level](Level.md)'s `grid`
- `clampTo` returns another `Rect`

## Members
| Member | Kind | Description |
|---|---|---|
| `new Rect(xa, ya, xb, yb)` | constructor | Two opposite corners, in any order |
| `x0`, `y0`, `x1`, `y1` | readonly properties | The normalised corners (`x0 <= x1`, `y0 <= y1`) |
| `width`, `height` | get accessors | Size in cells |
| `contains(col, row)` | method | Is the cell inside? |
| `onBorder(col, row)` | method | Is the cell on the edge? |
| `clampTo(width, height)` | method | The part inside a grid of that size, or `null` for an empty grid |
| `fill(grid, glyph)` | method | A new grid with every cell of the rectangle set to `glyph` |
| `outline(grid, glyph)` | method | A new grid with only the border set |

## Example
```ts
import { Rect } from '@2d-platform/level-format';

const grid = ['.....', '.....', '.....'];
new Rect(3, 2, 1, 0).outline(grid, '#');
// ['.###.', '.#.#.', '.###.']
```

## Design notes
- **Normalise in the constructor.** The corners are sorted once, so every
  method can rely on `x0 <= x1` — the constructor stays simple but
  establishes the class's invariant.
- **Pure methods.** `fill` and `outline` never modify the grid passed in,
  which makes undo in the editor trivial.
- **Template method in miniature.** Both painters share the private `paint`,
  passing a test for which cells to set; only that test differs.
