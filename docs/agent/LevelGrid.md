# LevelGrid

`packages/agent/src/LevelGrid.ts` · class

A level's grid seen through its legend: what role each cell has, where the
player can stand, and where the spawn, pickups and exits are.

## Relationships
- wraps a [ParsedLevel](ParsedLevel.md) and a [LegendRecord](LegendRecord.md)
- returns a [LevelLayout](LevelLayout.md) and [Cell](Cell.md)s; roles are [GlyphRole](GlyphRole.md)s
- used by [NavGraph](NavGraph.md), [PerFrameExpander](PerFrameExpander.md) and [PerFramePlanner](PerFramePlanner.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelGrid(level, legend?)` | constructor | No legend means the classic glyphs (`#`, `^`, `P`, `E`, `o`) |
| `glyphRole(legend, ch)` | static method | A glyph's role from the legend, or the classic glyphs without one |
| `cellAt(pos)` | static method | The cell under the centre of a tile-sized box at `pos` |
| `exitOverlapping(pos, exitCells)` | static method | The first exit cell a tile-sized box overlaps, or null |
| `width`, `height` | get accessors | The declared width; the number of rows |
| `roleAt(r, c)` | method | The role at a cell |
| `inBounds(r, c)` | method | Inside the grid? |
| `isWalkable(r, c)` | method | In bounds and not terrain or hazard |
| `isGrounded(r, c)` | method | Terrain directly below? |
| `settle(r, c)` | method | Where a player dropped here comes to rest, or null |
| `hasPlayerGlyph()` | method | Does any glyph have the player role? |
| `findLayout()` | method | The settled spawn, pickups and exits |

## Example
```ts
const grid = new LevelGrid(level, legend.toRecord());
const { start, pickupCells, exitCells } = grid.findLayout();
```

## Design notes
- **Roles, not glyphs.** A tileset can draw the player as `@`; the agent
  only asks what *role* a cell has, exactly as the engine does, so
  remapped legends plan correctly.
- **One class for the grid rules.** Walkable, grounded and settle are used
  by both planners; before, they were free functions passed the grid and
  legend on every call. Now the grid and legend are fields, and the
  methods read as questions about the level.
