import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPx, loadInitial } from './splitter.js';

// In-memory storage shim that mimics the Map-backed fallback the
// splitter uses under private-mode browsers.
const memStore = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

// --- clampPx ----------------------------------------------------------

test('clampPx: in-range value returned (rounded to integer)', () => {
  assert.equal(clampPx(640.4, 220, 220, 1280), 640);
  assert.equal(clampPx(640.6, 220, 220, 1280), 641);
});

test('clampPx: below minLeft → minLeft', () => {
  assert.equal(clampPx(10, 220, 220, 1280), 220);
  assert.equal(clampPx(-100, 220, 220, 1280), 220);
});

test('clampPx: above viewportW - minRight → that ceiling', () => {
  assert.equal(clampPx(2000, 220, 220, 1280), 1060); // 1280 - 220
  assert.equal(clampPx(1260, 220, 220, 1280), 1060);
});

test('clampPx: viewport too narrow for both mins → keeps minLeft', () => {
  // 300 - 220 = 80 ceiling, but minLeft is 220 → fall back to minLeft.
  assert.equal(clampPx(150, 220, 220, 300), 220);
  assert.equal(clampPx(NaN, 220, 220, 300), 220);
});

test('clampPx: non-finite / missing inputs degrade safely', () => {
  assert.equal(clampPx(undefined, 220, 220, 1280), 220);
  assert.equal(clampPx('not-a-number', 220, 220, 1280), 220);
  assert.equal(clampPx(640, 220, 220, undefined), 220); // viewport=0 → ceiling<min
});

// --- loadInitial ------------------------------------------------------

test('loadInitial: storage hit returns the integer (clamped)', () => {
  const s = memStore({ 'ld:v12:splitter': '700' });
  assert.equal(loadInitial(s, 1280), 700);
});

test('loadInitial: storage hit clamped if out of range for current viewport', () => {
  const s = memStore({ 'ld:v12:splitter': '2000' });
  assert.equal(loadInitial(s, 1280), 1060); // ceiling
  const s2 = memStore({ 'ld:v12:splitter': '50' });
  assert.equal(loadInitial(s2, 1280), 220); // floor
});

test('loadInitial: storage miss → half the viewport (clamped)', () => {
  const s = memStore();
  assert.equal(loadInitial(s, 1280), 640);
  assert.equal(loadInitial(s, 800), 400);
});

test('loadInitial: junk in storage → half the viewport', () => {
  const s = memStore({ 'ld:v12:splitter': 'not-a-number' });
  assert.equal(loadInitial(s, 1280), 640);
});

test('loadInitial: thrown storage.getItem (private mode) → half the viewport', () => {
  const s = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem() {},
    removeItem() {},
  };
  assert.equal(loadInitial(s, 1280), 640);
});

test('loadInitial: null storage degrades to the viewport-midpoint fallback', () => {
  assert.equal(loadInitial(null, 1280), 640);
  assert.equal(loadInitial(undefined, 1280), 640);
});

// --- v13: storageKey override ----------------------------------------

test('loadInitial: storageKey arg reads from a different key (v13 piggyback)', () => {
  const s = memStore({
    'ld:v12:splitter': '600',     // v12 horizontal pane width
    'ld:v13:problemsH': '180',    // v13 problems panel height
  });
  // Default key (v12): the horizontal pane width.
  assert.equal(loadInitial(s, 1280), 600);
  // Custom key (v13): the problems height — different value, same
  // helper. Mins differ between axes, so callers pass appropriate
  // mins too.
  assert.equal(
    loadInitial(s, 800, 60, 240, 'ld:v13:problemsH'),
    180,
  );
});
