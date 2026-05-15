import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './level.js';
import { draw } from './renderer.js';

// Minimal fake 2D context that records the calls the renderer makes.
function fakeCtx() {
  const calls = { fillRect: 0, arc: 0, fill: 0 };
  const canvas = { width: 0, height: 0 };
  return {
    canvas,
    calls,
    set fillStyle(_) {},
    fillRect: () => calls.fillRect++,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc: () => calls.arc++,
    fill: () => calls.fill++,
    drawImage() {},
  };
}

test('canvas is sized to grid * tile', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('# size: 4x2\n####\n#..#'), null, 10);
  assert.equal(ctx.canvas.width, 40);
  assert.equal(ctx.canvas.height, 20);
});

test('background cells are skipped, glyphs drawn via fallback', () => {
  const ctx = fakeCtx();
  // 1 sky fill + 6 wall blocks (#### + #..# = 6 walls; no atlas -> fallback)
  draw(ctx, parse('####\n#..#'), null, 10);
  assert.equal(ctx.calls.fillRect, 1 + 6);
});

test('entity glyphs use shape fallbacks', () => {
  const ctx = fakeCtx();
  draw(ctx, parse('P.o'), null, 10);
  assert.equal(ctx.calls.arc, 2); // P disc + o pip
});
