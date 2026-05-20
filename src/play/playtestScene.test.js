import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildViewGrid } from './playtestScene.js';

// `buildViewGrid` is pure — it returns a fresh array of rows with the
// chosen cells set to '.' and the others untouched. The static layer
// in `PlaytestScene.draw` uses it to hide the player's spawn glyph and
// collected coins from the editor renderer.

test('empty cleared list returns the same content (but a fresh array)', () => {
  const grid = ['#####', '#P.E#', '#####'];
  const out = buildViewGrid(grid, []);
  assert.deepEqual(out, grid);
  // Fresh strings: no mutation of the original.
  out[1] = 'mutated';
  assert.equal(grid[1], '#P.E#');
});

test('player spawn cell is replaced with "."', () => {
  const grid = ['#####', '#P.E#', '#####'];
  const out = buildViewGrid(grid, [{ r: 1, c: 1 }]);
  assert.deepEqual(out, ['#####', '#..E#', '#####']);
});

test('multiple collected-coin cells are replaced; uncollected stay', () => {
  const grid = ['##########', '#PooooE#..', '##########'];
  const out = buildViewGrid(grid, [
    { r: 1, c: 2 }, // first o collected
    { r: 1, c: 4 }, // third o collected
  ]);
  assert.equal(out[1], '#P.o.oE#..');
});

test('out-of-range cells are silently ignored, not thrown', () => {
  const grid = ['..', '..'];
  const out = buildViewGrid(grid, [
    { r: -1, c: 0 },     // negative row
    { r: 5, c: 0 },      // row past end
    { r: 0, c: 99 },     // col past end
    { r: 0, c: 0 },      // valid
  ]);
  assert.deepEqual(out, ['..', '..']);
  // The only in-range cell that mattered was a '.' already, so the
  // grid looks identical; the test's point is the negative/oversize
  // entries didn't crash.
});

test('original grid is not mutated even when many cells are cleared', () => {
  const grid = ['oooo', 'oooo'];
  const out = buildViewGrid(grid, [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 },
    { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 },
  ]);
  assert.deepEqual(out, ['....', '....']);
  assert.deepEqual(grid, ['oooo', 'oooo']);
});

test('decoration glyphs are untouched (only listed cells change)', () => {
  // A decoration is just a char in the grid; buildViewGrid is glyph-
  // agnostic — it only changes cells you explicitly list.
  const grid = ['T.b.', '.P.E'];
  const out = buildViewGrid(grid, [{ r: 1, c: 1 }]);
  assert.deepEqual(out, ['T.b.', '...E']);
});
