import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './level.js';
import { draw, autotileIndex } from './renderer.js';

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

// Records the atlas tile index passed to each drawTile call.
function fakeTileset() {
  const idx = [];
  return { ready: true, tileFor: () => undefined, drawTile: (_c, i) => idx.push(i), idx };
}

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

test('off-grid is solid: a fully-embedded block has no rim', () => {
  // Every neighbour (incl. off-grid) is solid → all dirt_centre.
  const g = ['###', '###', '###'];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) assert.equal(autotileIndex(g, r, c), 9);
});

test('boundary faces point at the play area (v4 rule)', () => {
  // Left wall at the map edge, open to the right → rim faces right.
  assert.equal(autotileIndex(['#..', '#..', '#..'], 1, 0), 10); // dirt_right
  // Right wall, open to the left → rim faces left.
  assert.equal(autotileIndex(['..#', '..#', '..#'], 1, 2), 8); // dirt_left
  // Floor (bottom edge), open above → rim faces up (walk surface).
  assert.equal(autotileIndex(['...', '###'], 1, 1), 1); // dirt_top
  // Ceiling (top edge), open below → rim faces down.
  assert.equal(autotileIndex(['###', '...'], 0, 1), 17); // dirt_bottom
});

test('free-standing block away from edges is unchanged', () => {
  // 3x3 block inside open space: rims still face outward as before.
  const g = ['.....', '.###.', '.###.', '.###.', '.....'];
  assert.equal(autotileIndex(g, 1, 1), 0); // top-left corner
  assert.equal(autotileIndex(g, 2, 1), 8); // left edge
  assert.equal(autotileIndex(g, 2, 2), 9); // centre
  assert.equal(autotileIndex(g, 3, 3), 18); // bottom-right corner
});

test('1-deep platform is dirt_top with corner end caps', () => {
  const g = ['.....', '.###.', '.....'];
  assert.equal(autotileIndex(g, 1, 1), 0); // left end → dirt_top_left
  assert.equal(autotileIndex(g, 1, 2), 1); // span → dirt_top
  assert.equal(autotileIndex(g, 1, 3), 2); // right end → dirt_top_right
});

test('atlas path: a bordered 3x3 block emits the full 9-slice set + sky fill', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // Block surrounded by open so all nine faces appear (off-grid is solid, so
  // an edge-touching block would be all centre — it must be inset).
  draw(ctx, parse('.....\n.###.\n.###.\n.###.\n.....'), ts, 8);
  assert.equal(ts.idx.filter((i) => i === 11).length, 25); // sky per cell
  const nine = new Set([0, 1, 2, 8, 9, 10, 16, 17, 18]);
  const got = new Set(ts.idx.filter((i) => nine.has(i)));
  assert.equal(got.size, 9); // every 9-slice tile used
});

test('atlas path: grass overlays dirt that has open sky above', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  // row 0 sky, row 1 dirt: each dirt cell gets a grass tile (21 or 22) above.
  draw(ctx, parse('...\n###'), ts, 8);
  const grass = ts.idx.filter((i) => i === 21 || i === 22).length;
  assert.equal(grass, 3);
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
