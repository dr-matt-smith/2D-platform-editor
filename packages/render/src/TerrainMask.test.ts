import { assertEquals } from '@std/assert';
import { Neighbour } from './Neighbour.ts';
import { TerrainMask } from './TerrainMask.ts';

// 3x3 grid with the centre solid and chosen orthogonal neighbours solid.
function around({ n, e, s, w }: { n: boolean; e: boolean; s: boolean; w: boolean }) {
  const g = [
    ['.', n ? '#' : '.', '.'],
    [w ? '#' : '.', '#', e ? '#' : '.'],
    ['.', s ? '#' : '.', '.'],
  ];
  return g.map((row) => row.join(''));
}

Deno.test('TerrainMask.at: all 16 neighbour combinations → N·1+E·2+S·4+W·8', () => {
  for (let m = 0; m < 16; m++) {
    const n = !!(m & 1);
    const e = !!(m & 2);
    const s = !!(m & 4);
    const w = !!(m & 8);
    assertEquals(TerrainMask.at(around({ n, e, s, w }), 1, 1).value, m);
  }
});

Deno.test('TerrainMask.at: off-grid counts as solid', () => {
  assertEquals(TerrainMask.at(['#'], 0, 0).value, 15); // 1x1: all neighbours off-grid
  assertEquals(TerrainMask.at(['...', '.#.', '...'], 1, 1).value, 0); // lone, all open
  // left-edge column cell: W off-grid (solid) + N,S solid, E open → 1+4+8
  assertEquals(TerrainMask.at(['#..', '#..', '#..'], 1, 0).value, 13);
});

Deno.test('THIN_VALUES is exactly the one-cell-thin platform mask set', () => {
  assertEquals([...TerrainMask.THIN_VALUES].sort((a, b) => a - b), [0, 1, 2, 4, 5, 8, 10]);
});

Deno.test('TerrainMask.has reads each side; isThin matches THIN_VALUES', () => {
  const mask = TerrainMask.at(around({ n: true, e: false, s: true, w: false }), 1, 1);
  assertEquals(mask.value, 5);
  assertEquals(mask.has(Neighbour.North), true);
  assertEquals(mask.has(Neighbour.East), false);
  assertEquals(mask.has(Neighbour.South), true);
  assertEquals(mask.has(Neighbour.West), false);
  assertEquals(mask.isThin, true);
  assertEquals(TerrainMask.at(['#'], 0, 0).isThin, false);
});

Deno.test('TerrainMask.isSolid: terrain glyph or off-grid', () => {
  const grid = ['#.', '..'];
  assertEquals(TerrainMask.isSolid(grid, 0, 0), true);
  assertEquals(TerrainMask.isSolid(grid, 0, 1), false);
  assertEquals(TerrainMask.isSolid(grid, -1, 0), true);
  assertEquals(TerrainMask.isSolid(grid, 0, 2), true);
  assertEquals(TerrainMask.GLYPH, '#');
});
