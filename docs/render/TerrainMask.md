# TerrainMask

`packages/render/src/TerrainMask.ts` · class

Which of a terrain cell's four neighbours are solid, packed into a number
0–15: North·1 + East·2 + South·4 + West·8. A tileset keys its terrain images
by this number (autotiling), so a cell with sky above gets a grassy top, a
cell with a wall to its left an edge, and so on.

## Relationships
- built per `#` cell by [LevelRenderer](LevelRenderer.md); its `value` goes to [RenderTileset](RenderTileset.md)`.terrainFor`
- sides named by [Neighbour](Neighbour.md)
- keys the `terrain.masks` table of a [TileLookup](TileLookup.md) ([TerrainDecl](TerrainDecl.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `GLYPH` | static readonly | `'#'` — the glyph autotiled as terrain |
| `THIN_VALUES` | static readonly | `{0, 1, 2, 4, 5, 8, 10}` — one-cell-thin pieces (single block, end caps, middles of runs) |
| `at(grid, r, c)` | static method | The mask of a cell |
| `isSolid(grid, r, c)` | static method | Is the cell terrain? Off the grid counts as solid |
| `value` | readonly property | 0–15 |
| `has(side)` | method | Is the [Neighbour](Neighbour.md) on that side solid? |
| `isThin` | get accessor | Is `value` one of `THIN_VALUES`? |

## Example
```ts
const mask = TerrainMask.at(['.#.', '###', '...'], 1, 1);
mask.value;                    // 1 (N) + 2 (E) + 8 (W) = 11
mask.has(Neighbour.South);     // false
tileset.terrainFor(mask.value);
```

## Design notes
- **Value object** with a private constructor: masks come only from `at`,
  so every mask is a real 0–15 value.
- **Off-grid is solid.** The level is carved out of solid ground, so walls
  at the edge of the map show their rocky face to the play area.
- The decor pass skips thin cells because their tiles are finished platform
  art, which is why `isThin` lives here with the rest of the mask meaning.
