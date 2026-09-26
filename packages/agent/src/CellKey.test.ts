import { assertEquals } from '@std/assert';
import { CellKey } from './CellKey.ts';

Deno.test('CellKey.of writes "r,c"', () => {
  assertEquals(CellKey.of(3, 12), '3,12');
});

Deno.test('CellKey.parse reads a cell key, or the cell of a state key', () => {
  assertEquals(CellKey.parse('3,12'), { r: 3, c: 12 });
  assertEquals(CellKey.parse('3,12,-1,L'), { r: 3, c: 12 });
});
