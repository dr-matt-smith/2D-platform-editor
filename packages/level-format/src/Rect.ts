// A rectangle of grid cells, used by the editor's drag-to-fill and
// drag-to-outline tools. Corners may be given in any order; the rectangle
// always stores them normalised (x0 <= x1, y0 <= y1).
//
// Painting is pure: `fill` and `outline` return a new grid and never
// modify the one passed in.
export class Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;

  constructor(xa: number, ya: number, xb: number, yb: number) {
    this.x0 = Math.min(xa, xb);
    this.x1 = Math.max(xa, xb);
    this.y0 = Math.min(ya, yb);
    this.y1 = Math.max(ya, yb);
  }

  get width(): number {
    return this.x1 - this.x0 + 1;
  }

  get height(): number {
    return this.y1 - this.y0 + 1;
  }

  contains(col: number, row: number): boolean {
    return col >= this.x0 && col <= this.x1 && row >= this.y0 && row <= this.y1;
  }

  // True when the cell lies on the rectangle's border.
  onBorder(col: number, row: number): boolean {
    return this.contains(col, row) &&
      (row === this.y0 || row === this.y1 || col === this.x0 || col === this.x1);
  }

  // The part of this rectangle inside a `width` x `height` grid, or null
  // when the grid is empty. A rectangle entirely off the grid clamps to
  // the nearest edge cells.
  clampTo(width: number, height: number): Rect | null {
    if (!width || !height) return null;
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
    return new Rect(
      clamp(this.x0, width - 1),
      clamp(this.y0, height - 1),
      clamp(this.x1, width - 1),
      clamp(this.y1, height - 1),
    );
  }

  // Set every cell of the rectangle to `glyph` (its first character).
  fill(grid: readonly string[], glyph: string): string[] {
    return this.paint(grid, glyph, (r, c, row) => r.contains(c, row));
  }

  // Set only the border cells to `glyph`, leaving the interior alone.
  outline(grid: readonly string[], glyph: string): string[] {
    return this.paint(grid, glyph, (r, c, row) => r.onBorder(c, row));
  }

  // Clamp to the grid, then write `glyph` wherever `test` says so. The
  // border is judged on the clamped rectangle, as the user sees it.
  private paint(
    grid: readonly string[],
    glyph: string,
    test: (clamped: Rect, col: number, row: number) => boolean,
  ): string[] {
    const clamped = this.clampTo(grid.length ? grid[0].length : 0, grid.length);
    if (!clamped) return grid.slice();
    const g = glyph[0];
    return grid.map((line, row) => {
      if (row < clamped.y0 || row > clamped.y1) return line;
      const cells = line.split('');
      for (let col = clamped.x0; col <= clamped.x1; col++) {
        if (test(clamped, col, row)) cells[col] = g;
      }
      return cells.join('');
    });
  }
}
