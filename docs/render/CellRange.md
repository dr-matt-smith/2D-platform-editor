# CellRange

`packages/render/src/CellRange.ts` · class

A rectangle of grid cells — rows `r0` to `r1`, columns `c0` to `c1` (ends
not included). The renderer visits only these cells, so a scrolling view of
a big level draws what is on screen rather than the whole world.

## Relationships
- built from a [CameraWindow](CameraWindow.md) (`visible`) or a grid size (`all`)
- used by every pass of [LevelRenderer](LevelRenderer.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new CellRange(r0, r1, c0, c1)` | constructor | Half-open bounds |
| `r0`, `r1`, `c0`, `c1` | readonly properties | The bounds |
| `all(rows, cols)` | static method | Every cell of the grid |
| `visible(camera, tile, rows, cols)` | static method | The cells the camera sees, plus one on each side, clipped to the grid |
| `size` | get accessor | Number of cells |
| `forEach(visit)` | method | Call `visit(r, c)` row by row, left to right |

## Example
```ts
const cells = CellRange.visible({ camX: 20, camY: 0, viewW: 50, viewH: 30 }, 10, 4, 40);
cells.forEach((r, c) => drawCell(r, c));   // columns 1..7, rows 0..3
```

## Design notes
- **Immutable value object** with named static factories for its two uses.
- **The extra cell.** It lets tiles cut by the view edge draw whole, and
  lets decor that depends on a neighbour (grass above terrain) start from
  terrain just out of view.
- **Encapsulated iteration.** `forEach` replaces the same nested `for`
  loops the renderer used to repeat in every pass.
