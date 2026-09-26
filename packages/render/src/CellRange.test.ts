import { assertEquals } from '@std/assert';
import { CellRange } from './CellRange.ts';

Deno.test('CellRange.all covers the whole grid', () => {
  const range = CellRange.all(3, 5);
  assertEquals([range.r0, range.r1, range.c0, range.c1], [0, 3, 0, 5]);
  assertEquals(range.size, 15);
});

Deno.test('CellRange.visible adds one cell of bleed each side, clipped to the grid', () => {
  // 10-px tiles; view 50x30 at (20.4, 5.7) → cols 2..7, rows 0..3, plus bleed.
  const range = CellRange.visible({ camX: 20.4, camY: 5.7, viewW: 50, viewH: 30 }, 10, 4, 40);
  assertEquals([range.r0, range.r1, range.c0, range.c1], [0, 4, 1, 9]);
  // A view bigger than the world clips to the grid.
  const big = CellRange.visible({ camX: 0, camY: 0, viewW: 200, viewH: 200 }, 10, 4, 4);
  assertEquals([big.r0, big.r1, big.c0, big.c1], [0, 4, 0, 4]);
});

Deno.test('CellRange.forEach visits row by row, left to right', () => {
  const seen: string[] = [];
  new CellRange(1, 3, 2, 4).forEach((r, c) => seen.push(`${r},${c}`));
  assertEquals(seen, ['1,2', '1,3', '2,2', '2,3']);
});
