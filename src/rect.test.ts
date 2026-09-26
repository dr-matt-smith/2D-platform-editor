import { assert, assertEquals } from '@std/assert';
import { fillRect, outlineRect } from './level.ts';

const G = () => ['.....', '.....', '.....', '.....', '.....'];

Deno.test('fillRect fills the rectangle and is corner-order independent', () => {
  const a = fillRect(G(), 1, 1, 3, 2, '#');
  assertEquals(a, ['.....', '.###.', '.###.', '.....', '.....']);
  // same rectangle, corners given reversed
  assertEquals(fillRect(G(), 3, 2, 1, 1, '#'), a);
});

Deno.test('fillRect does not mutate the input grid', () => {
  const g = G();
  fillRect(g, 0, 0, 4, 4, '#');
  assertEquals(g, G());
});

Deno.test('fillRect clamps a rectangle that runs past the bounds', () => {
  assertEquals(fillRect(G(), 3, 3, 99, 99, '#'), [
    '.....',
    '.....',
    '.....',
    '...##',
    '...##',
  ]);
});

Deno.test('fillRect preserves grid dimensions', () => {
  const out = fillRect(G(), -5, -5, 99, 99, '#');
  assertEquals(out.length, 5);
  assert(out.every((r) => r.length === 5));
});

Deno.test('outlineRect draws the border only', () => {
  assertEquals(outlineRect(G(), 0, 0, 4, 4, '#'), [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####',
  ]);
});

Deno.test('a single-cell rectangle sets one cell', () => {
  assertEquals(fillRect(G(), 2, 2, 2, 2, '#'), [
    '.....',
    '.....',
    '..#..',
    '.....',
    '.....',
  ]);
});

Deno.test('filling with "." erases', () => {
  const filled = fillRect(G(), 0, 0, 4, 4, '#');
  assertEquals(fillRect(filled, 1, 1, 3, 3, '.'), [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####',
  ]);
});

Deno.test('empty grid is handled', () => {
  assertEquals(fillRect([], 0, 0, 2, 2, '#'), []);
});
