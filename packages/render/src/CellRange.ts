import type { CameraWindow } from './CameraWindow.ts';

// A rectangle of grid cells: rows r0 up to (not including) r1, columns c0
// up to c1. The renderer visits only these cells, so a scrolling view of
// a big level draws what is on screen rather than the whole world.
export class CellRange {
  constructor(
    readonly r0: number,
    readonly r1: number,
    readonly c0: number,
    readonly c1: number,
  ) {}

  // Every cell of a `rows` × `cols` grid.
  static all(rows: number, cols: number): CellRange {
    return new CellRange(0, rows, 0, cols);
  }

  // The cells a camera can see, plus one cell on each side, clipped to
  // the grid. The extra cell lets tiles cut by the view edge draw fully,
  // and lets decor that depends on a neighbour (grass above terrain, drips
  // below it) start from terrain just out of view.
  static visible(camera: CameraWindow, tile: number, rows: number, cols: number): CellRange {
    return new CellRange(
      Math.max(0, Math.floor(camera.camY / tile) - 1),
      Math.min(rows, Math.ceil((camera.camY + camera.viewH) / tile) + 1),
      Math.max(0, Math.floor(camera.camX / tile) - 1),
      Math.min(cols, Math.ceil((camera.camX + camera.viewW) / tile) + 1),
    );
  }

  // Number of cells in the range.
  get size(): number {
    return Math.max(0, this.r1 - this.r0) * Math.max(0, this.c1 - this.c0);
  }

  // Call `visit(r, c)` for each cell, row by row, left to right.
  forEach(visit: (r: number, c: number) => void): void {
    for (let r = this.r0; r < this.r1; r++) {
      for (let c = this.c0; c < this.c1; c++) visit(r, c);
    }
  }
}
