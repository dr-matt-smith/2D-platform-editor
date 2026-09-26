import { Neighbour } from './Neighbour.ts';

// Which of a terrain cell's four neighbours are solid, packed into a
// number from 0 to 15: North·1 + East·2 + South·4 + West·8. A tileset
// keys its terrain images by this number (autotiling), so a cell with
// open sky above gets a grassy top, a cell with a wall to its left gets
// an edge, and so on.
export class TerrainMask {
  // The glyph the renderer autotiles as terrain.
  static readonly GLYPH = '#';

  // The masks of one-cell-thin terrain: a single block, the four end
  // caps, and the middles of a vertical or horizontal run. These are
  // finished platform tiles, so the decor pass leaves them alone.
  static readonly THIN_VALUES: ReadonlySet<number> = new Set([0, 1, 2, 4, 5, 8, 10]);

  private static readonly BIT: Readonly<Record<Neighbour, number>> = Object.freeze({
    [Neighbour.North]: 1,
    [Neighbour.East]: 2,
    [Neighbour.South]: 4,
    [Neighbour.West]: 8,
  });

  private constructor(readonly value: number) {}

  // The mask of the cell at row `r`, column `c`.
  static at(grid: readonly string[], r: number, c: number): TerrainMask {
    const solid = TerrainMask.isSolid;
    const bit = TerrainMask.BIT;
    return new TerrainMask(
      (solid(grid, r - 1, c) ? bit[Neighbour.North] : 0) |
        (solid(grid, r, c + 1) ? bit[Neighbour.East] : 0) |
        (solid(grid, r + 1, c) ? bit[Neighbour.South] : 0) |
        (solid(grid, r, c - 1) ? bit[Neighbour.West] : 0),
    );
  }

  // Is the cell terrain? Off the grid counts as solid: the level is carved
  // out of solid ground, so boundary walls show their rocky face to the
  // play area rather than to the edge of the map.
  static isSolid(grid: readonly string[], r: number, c: number): boolean {
    return r < 0 || r >= grid.length || c < 0 || c >= grid[r].length ||
      grid[r][c] === TerrainMask.GLYPH;
  }

  // Is the neighbour on that side solid?
  has(side: Neighbour): boolean {
    return (this.value & TerrainMask.BIT[side]) !== 0;
  }

  // Is this a one-cell-thin piece of terrain (see `THIN_VALUES`)?
  get isThin(): boolean {
    return TerrainMask.THIN_VALUES.has(this.value);
  }
}
