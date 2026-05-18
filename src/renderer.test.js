import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// Records decor/bg indices (drawTile) and filled-terrain masks (drawFilled).
function fakeTileset() {
  const idx = [];
  const masks = [];
  return {
    ready: true,
    drawTile: (_c, i) => idx.push(i),
    drawFilled: (_c, m) => masks.push(m),
    idx,
    masks,
  };
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

test('atlas path: an inset 3x3 block emits the 9 thick masks + sky fill', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('.....\n.###.\n.###.\n.###.\n.....'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 11).length, 25); // sky per cell
  // 9 distinct thick masks (corners 3/6/9/12, edges 7/11/13/14, centre 15).
  assert.deepEqual(
    [...new Set(ts.masks)].sort((a, b) => a - b),
    [3, 6, 7, 9, 11, 12, 13, 14, 15],
  );
  assert.equal(ts.masks.some((m) => THIN.has(m)), false);
});

test('atlas path: thin runs emit thin masks + suppress decor', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // Floating 1-wide pillar (col 2), a 1-tall ledge (row 5), a lone cell.
  draw(
    ctx,
    parse(
      ['........', '..#.....', '..#.....', '..#.....', '........',
       '....###.', '........', '......#.', '........'].join('\n'),
    ),
    ts,
    8,
  );
  // pillar cap-top/mid-v/cap-bottom = 4/5/1; ledge cap-left/mid-h/cap-right
  // = 2/10/8; single = 0. All THIN.
  for (const m of [4, 5, 1, 2, 10, 8, 0])
    assert.ok(ts.masks.includes(m), `expected thin mask ${m}`);
  assert.equal(ts.masks.every((m) => THIN.has(m)), true);
  // decor suppressed on the finished platform art: no grass/drip emitted.
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

// Regression gate: the Dirt tile_lookup.json must map every mask to the same
// tile v6 drew (design §4 table). With the tileMask test above, this proves
// the v7 render is byte-identical to v6 without rendering.
test('Dirt tile_lookup maps each mask to the v6 §4 tile', () => {
  const lookup = JSON.parse(
    readFileSync(
      'public/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json',
      'utf8',
    ),
  );
  const v6Index = [27, 20, 24, 16, 4, 12, 0, 8, 26, 18, 25, 17, 2, 10, 1, 9];
  for (let m = 0; m < 16; m++) {
    const file = lookup.filled[String(m)].image; // e.g. tiles/00_dirt_top_left.png
    const lead = Number(file.match(/(\d+)_/)[1]);
    assert.equal(lead, v6Index[m], `mask ${m}`);
  }
});
