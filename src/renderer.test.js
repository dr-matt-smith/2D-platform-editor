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

test('autotileIndex picks the right 9-slice cell', () => {
  const g = ['###', '###', '###'];
  assert.equal(autotileIndex(g, 0, 0), 0); // top-left corner
  assert.equal(autotileIndex(g, 0, 1), 1); // top edge
  assert.equal(autotileIndex(g, 1, 0), 8); // left edge
  assert.equal(autotileIndex(g, 1, 1), 9); // centre (all neighbours solid)
  assert.equal(autotileIndex(g, 2, 2), 18); // bottom-right corner
});

test('atlas path: 3x3 block emits the full 9-slice set + sky fill', () => {
  const ctx = fakeCtx();
  const ts = fakeTileset();
  draw(ctx, parse('###\n###\n###'), ts, 8);
  const sky = ts.idx.filter((i) => i === 11).length;
  assert.equal(sky, 9); // one sky tile per cell (background pass)
  const dirt = ts.idx.filter((i) => i !== 11).sort((a, b) => a - b);
  assert.deepEqual(dirt, [0, 1, 2, 8, 9, 10, 16, 17, 18]);
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
