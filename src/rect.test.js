import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillRect, outlineRect } from './level.js';

const G = () => ['.....', '.....', '.....', '.....', '.....'];

test('fillRect fills the rectangle and is corner-order independent', () => {
  const a = fillRect(G(), 1, 1, 3, 2, '#');
  assert.deepEqual(a, ['.....', '.###.', '.###.', '.....', '.....']);
  // same rectangle, corners given reversed
  assert.deepEqual(fillRect(G(), 3, 2, 1, 1, '#'), a);
});

test('fillRect does not mutate the input grid', () => {
  const g = G();
  fillRect(g, 0, 0, 4, 4, '#');
  assert.deepEqual(g, G());
});

test('fillRect clamps a rectangle that runs past the bounds', () => {
  assert.deepEqual(fillRect(G(), 3, 3, 99, 99, '#'), [
    '.....',
    '.....',
    '.....',
    '...##',
    '...##',
  ]);
});

test('fillRect preserves grid dimensions', () => {
  const out = fillRect(G(), -5, -5, 99, 99, '#');
  assert.equal(out.length, 5);
  assert.ok(out.every((r) => r.length === 5));
});

test('outlineRect draws the border only', () => {
  assert.deepEqual(outlineRect(G(), 0, 0, 4, 4, '#'), [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####',
  ]);
});

test('a single-cell rectangle sets one cell', () => {
  assert.deepEqual(fillRect(G(), 2, 2, 2, 2, '#'), [
    '.....',
    '.....',
    '..#..',
    '.....',
    '.....',
  ]);
});

test('filling with "." erases', () => {
  const filled = fillRect(G(), 0, 0, 4, 4, '#');
  assert.deepEqual(fillRect(filled, 1, 1, 3, 3, '.'), [
    '#####',
    '#...#',
    '#...#',
    '#...#',
    '#####',
  ]);
});

test('empty grid is handled', () => {
  assert.deepEqual(fillRect([], 0, 0, 2, 2, '#'), []);
});
