import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './level.js';
import { draw, tileMask, THIN } from './renderer.js';

function fakeCtx() {
  const calls = { fillRect: 0, arc: 0 };
  return {
    canvas: { width: 0, height: 0 },
    set fillStyle(_) {},
    fillRect: () => calls.fillRect++,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc: () => calls.arc++,
    fill() {},
    drawImage() {},
    calls,
  };
}

// Records the tile index passed to each drawTile call.
function fakeTileset() {
  const idx = [];
  return { ready: true, tileFor: () => undefined, drawTile: (_c, i) => idx.push(i), idx };
}

// 3x3 grid with the centre solid and chosen orthogonal neighbours solid.
function around({ n, e, s, w }) {
  const g = [
    ['.', n ? '#' : '.', '.'],
    [w ? '#' : '.', '#', e ? '#' : '.'],
    ['.', s ? '#' : '.', '.'],
  ];
  return g.map((row) => row.join(''));
}

test('tileMask: all 16 neighbour combinations → N·1+E·2+S·4+W·8', () => {
  for (let m = 0; m < 16; m++) {
    const n = !!(m & 1);
    const e = !!(m & 2);
    const s = !!(m & 4);
    const w = !!(m & 8);
    assert.equal(tileMask(around({ n, e, s, w }), 1, 1), m);
  }
});

test('tileMask: off-grid counts as solid (v4 rule)', () => {
  assert.equal(tileMask(['#'], 0, 0), 15); // 1x1: all neighbours off-grid
  assert.equal(tileMask(['...', '.#.', '...'], 1, 1), 0); // lone, all open
  // left-edge column cell: W off-grid (solid) + N,S solid, E open → 1+4+8
  assert.equal(tileMask(['#..', '#..', '#..'], 1, 0), 13);
});

test('THIN is exactly the v5 platform-cell mask set', () => {
  assert.deepEqual([...THIN].sort((a, b) => a - b), [0, 1, 2, 4, 5, 8, 10]);
});

test('canvas is sized to grid * tile', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('# size: 4x2\n####\n#..#'), null, 10);
  assert.equal(ctx.canvas.width, 40);
  assert.equal(ctx.canvas.height, 20);
});

test('no-atlas path: walls drawn as fallback blocks, bg skipped', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('####\n#..#'), null, 10); // 1 sky rect + 6 wall blocks
  assert.equal(ctx.calls.fillRect, 1 + 6);
});

test('no-atlas path: entity glyphs use shape fallbacks', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('P.o'), null, 10);
  assert.equal(ctx.calls.arc, 2); // P disc + o pip
});

test('atlas path: a bordered 3x3 block emits the full 9-slice set + sky fill', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // Inset block → all nine thick faces appear (off-grid is solid).
  draw(ctx, parse('.....\n.###.\n.###.\n.###.\n.....'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 11).length, 25); // sky per cell
  const nine = new Set([0, 1, 2, 8, 9, 10, 16, 17, 18]);
  assert.equal(new Set(ts.idx.filter((i) => nine.has(i))).size, 9);
});

test('atlas path: thin runs emit platform tiles + suppress decor', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // Floating 1-wide pillar (cols 2), a 1-tall ledge (row 5), a lone cell.
  draw(
    ctx,
    parse(
      ['........', '..#.....', '..#.....', '..#.....', '........',
       '....###.', '........', '......#.', '........'].join('\n'),
    ),
    ts,
    8,
  );
  // pillar caps/mid 4/20/12, ledge caps/mid 24/26/25, single 27.
  for (const i of [4, 20, 12, 24, 26, 25, 27])
    assert.ok(ts.idx.includes(i), `expected platform tile ${i}`);
  // none of these are grass(21/22) or drip(15/23) — decor suppressed on them.
  assert.equal(ts.idx.filter((i) => [21, 22, 23, 15].includes(i)).length, 0);
});

test('atlas path: grass overlays dirt that has open sky above', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('...\n###'), ts, 8); // row1 is a thick bottom edge, not thin
  assert.equal(ts.idx.filter((i) => i === 21 || i === 22).length, 3);
});

test('cave theme: dark bg, no grass/moon/stars, drips kept', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('# theme: cave\n...\n###'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 19).length, 6); // dirt_fill bg
  assert.equal(ts.idx.filter((i) => i === 11).length, 0); // no sky tile
  assert.equal(ts.idx.filter((i) => i === 21 || i === 22).length, 0); // no grass
  assert.equal(ts.idx.filter((i) => i === 3).length, 0); // no moon
});
