import { assert, assertEquals } from '@std/assert';
import { Rect } from './Rect.ts';

const G = () => ['.....', '.....', '.....', '.....', '.....'];

Deno.test('fill fills the rectangle and is corner-order independent', () => {
  const a = new Rect(1, 1, 3, 2).fill(G(), '#');
  assertEquals(a, ['.....', '.###.', '.###.', '.....', '.....']);
  // same rectangle, corners given reversed
  assertEquals(new Rect(3, 2, 1, 1).fill(G(), '#'), a);
});

Deno.test('fill does not mutate the input grid', () => {
  const g = G();
  new Rect(0, 0, 4, 4).fill(g, '#');
  assertEquals(g, G());
});

Deno.test('fill clamps a rectangle that runs past the bounds', () => {
  assertEquals(new Rect(3, 3, 99, 99).fill(G(), '#'), ['.....', '.....', '.....', '...##', '...##']);
});

Deno.test('fill preserves grid dimensions', () => {
  const out = new Rect(-5, -5, 99, 99).fill(G(), '#');
  assertEquals(out.length, 5);
  assert(out.every((r) => r.length === 5));
});

Deno.test('outline draws the border only', () => {
  assertEquals(new Rect(0, 0, 4, 4).outline(G(), '#'), ['#####', '#...#', '#...#', '#...#', '#####']);
});

Deno.test('a single-cell rectangle sets one cell', () => {
  assertEquals(new Rect(2, 2, 2, 2).fill(G(), '#'), ['.....', '.....', '..#..', '.....', '.....']);
});

Deno.test('filling with "." erases', () => {
  const filled = new Rect(0, 0, 4, 4).fill(G(), '#');
  assertEquals(new Rect(1, 1, 3, 3).fill(filled, '.'), ['#####', '#...#', '#...#', '#...#', '#####']);
});

Deno.test('empty grid is handled', () => {
  assertEquals(new Rect(0, 0, 2, 2).fill([], '#'), []);
});

Deno.test('corners are normalised; width/height count cells', () => {
  const r = new Rect(3, 4, 1, 2);
  assertEquals([r.x0, r.y0, r.x1, r.y1], [1, 2, 3, 4]);
  assertEquals(r.width, 3);
  assertEquals(r.height, 3);
});

Deno.test('contains / onBorder', () => {
  const r = new Rect(0, 0, 2, 2);
  assertEquals(r.contains(1, 1), true);
  assertEquals(r.contains(3, 1), false);
  assertEquals(r.onBorder(0, 1), true);
  assertEquals(r.onBorder(1, 1), false);
  assertEquals(r.onBorder(3, 0), false);
});

Deno.test('clampTo keeps the rectangle inside the grid; null for an empty grid', () => {
  const c = new Rect(-2, 1, 9, 9).clampTo(5, 3)!;
  assertEquals([c.x0, c.y0, c.x1, c.y1], [0, 1, 4, 2]);
  assertEquals(new Rect(0, 0, 1, 1).clampTo(0, 0), null);
});

Deno.test('outline of a clamped rectangle draws the border at the grid edge', () => {
  assertEquals(new Rect(2, 2, 99, 99).outline(G(), '#'), ['.....', '.....', '..###', '..#.#', '..###']);
});
