import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centerCamera, computeCamera } from './playtestCamera.js';

// All values in world pixels. A "20x12 viewport at 20px/cell" is 400x240.
const VP = { w: 400, h: 240 };
// 40x16 cells world = 800x320 (twice as wide as the viewport, slightly
// taller). Tests use this unless otherwise stated.
const WORLD = { w: 800, h: 320 };

// --- centerCamera ----------------------------------------------------

test('centerCamera: player at world centre sits at viewport centre', () => {
  // Player center at (400, 160) (= world/2). Camera should be at
  // (400 - vw/2, 160 - vh/2) = (200, 40).
  const c = centerCamera({ x: 400, y: 160 }, VP, WORLD);
  assert.deepEqual(c, { camX: 200, camY: 40 });
});

test('centerCamera: player near left world edge clamps camera to 0', () => {
  const c = centerCamera({ x: 50, y: 160 }, VP, WORLD);
  assert.equal(c.camX, 0);
});

test('centerCamera: player near right world edge clamps to world-viewport', () => {
  const c = centerCamera({ x: 780, y: 160 }, VP, WORLD);
  assert.equal(c.camX, WORLD.w - VP.w); // 800 - 400 = 400
});

test('centerCamera: world smaller than viewport pins both axes to 0', () => {
  const small = { w: 200, h: 120 };
  const c = centerCamera({ x: 100, y: 60 }, VP, small);
  assert.deepEqual(c, { camX: 0, camY: 0 });
});

// --- computeCamera: dead-zone follow --------------------------------

test('computeCamera: player inside dead-zone leaves camera unchanged', () => {
  // 40% × 33% dead-zone centred → half-margin = 120 px wide, 80.4 px tall.
  // Player slightly off centre but still inside the dead-zone.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 410, y: 165 }, prev, VP, WORLD);
  assert.deepEqual(c, prev);
});

test('computeCamera: player crosses LEFT dead-zone edge → camera shifts left by overshoot', () => {
  // half-margin = (400 - 160)/2 = 120. With prev camX=200, the left
  // edge of the dead-zone is at world-x = 200 + 120 = 320. Put the
  // player at x=300 (20 past the edge); camera should move left by 20.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 300, y: 160 }, prev, VP, WORLD);
  assert.equal(c.camX, 180);
});

test('computeCamera: player crosses RIGHT dead-zone edge → camera shifts right', () => {
  // Right edge of dead-zone at prev.camX + viewport - half-margin =
  // 200 + 400 - 120 = 480. Player at 500 is 20 past; camera moves
  // right to 220.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 500, y: 160 }, prev, VP, WORLD);
  assert.equal(c.camX, 220);
});

test('computeCamera: player crosses TOP dead-zone edge → camera shifts up', () => {
  // half-margin H = (240 - 79.2)/2 = 80.4. Top edge at prev.camY +
  // half-margin = 40 + 80.4 = 120.4. Player at y=100 is past the
  // top edge; camera moves up by 20.4.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 400, y: 100 }, prev, VP, WORLD);
  assert.ok(Math.abs(c.camY - 19.6) < 1e-6);
});

test('computeCamera: player crosses BOTTOM dead-zone edge → camera shifts down', () => {
  // Bottom edge at prev.camY + vh - half-margin H = 40 + 240 - 80.4 =
  // 199.6. Player at y=240 is 40.4 past; world clamps to (world.h -
  // viewport.h) = 320 - 240 = 80; expected min(40 + 40.4, 80) = 80.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 400, y: 240 }, prev, VP, WORLD);
  assert.equal(c.camY, 80);
});

test('computeCamera: world-clamp prevents camX going negative', () => {
  // Player at x=0 with prev camX at left edge → would compute camX
  // = 0 - 120 = -120 → clamp to 0.
  const c = computeCamera({ x: 0, y: 160 }, { camX: 100, camY: 40 }, VP, WORLD);
  assert.equal(c.camX, 0);
});

test('computeCamera: world-clamp prevents camX going past world-viewport', () => {
  // Player at far right edge of world; would push camera past world
  // width − viewport. Expected clamp to 400.
  const c = computeCamera({ x: 800, y: 160 }, { camX: 380, camY: 40 }, VP, WORLD);
  assert.equal(c.camX, WORLD.w - VP.w);
});

test('computeCamera: world smaller than viewport pins both axes to 0', () => {
  // 12×8 cell world = 240×96, smaller than the 400×240 viewport.
  // Any player position → camera (0, 0).
  const small = { w: 240, h: 96 };
  const c = computeCamera({ x: 100, y: 50 }, { camX: 0, camY: 0 }, VP, small);
  assert.deepEqual(c, { camX: 0, camY: 0 });
});

test('computeCamera: custom dead-zone fractions affect threshold', () => {
  // 20% × 20% dead-zone → half-margin = (400 − 80)/2 = 160 on x. Left
  // edge of dead-zone at 200 + 160 = 360. Player at 340 (20 past)
  // moves camera to 340 − 160 = 180.
  const prev = { camX: 200, camY: 40 };
  const c = computeCamera({ x: 340, y: 160 }, prev, VP, WORLD, {
    deadZone: { w: 0.2, h: 0.2 },
  });
  assert.equal(c.camX, 180);
});

test('computeCamera: never mutates inputs', () => {
  const prev = Object.freeze({ camX: 200, camY: 40 });
  const player = Object.freeze({ x: 300, y: 100 });
  const vp = Object.freeze({ ...VP });
  const w = Object.freeze({ ...WORLD });
  // The freezes would throw on any mutation attempt — assert.doesNotThrow
  // is the assertion of purity here.
  assert.doesNotThrow(() => computeCamera(player, prev, vp, w));
});
