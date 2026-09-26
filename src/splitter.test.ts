import { assertEquals } from '@std/assert';
import { clampPx, loadInitial } from './splitter.ts';

// In-memory storage shim that mimics the Map-backed fallback the
// splitter uses under private-mode browsers.
const memStore = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
  };
};

// --- clampPx ----------------------------------------------------------

Deno.test('clampPx: in-range value returned (rounded to integer)', () => {
  assertEquals(clampPx(640.4, 220, 220, 1280), 640);
  assertEquals(clampPx(640.6, 220, 220, 1280), 641);
});

Deno.test('clampPx: below minLeft → minLeft', () => {
  assertEquals(clampPx(10, 220, 220, 1280), 220);
  assertEquals(clampPx(-100, 220, 220, 1280), 220);
});

Deno.test('clampPx: above viewportW - minRight → that ceiling', () => {
  assertEquals(clampPx(2000, 220, 220, 1280), 1060); // 1280 - 220
  assertEquals(clampPx(1260, 220, 220, 1280), 1060);
});

Deno.test('clampPx: viewport too narrow for both mins → keeps minLeft', () => {
  // 300 - 220 = 80 ceiling, but minLeft is 220 → fall back to minLeft.
  assertEquals(clampPx(150, 220, 220, 300), 220);
  assertEquals(clampPx(NaN, 220, 220, 300), 220);
});

Deno.test('clampPx: non-finite / missing inputs degrade safely', () => {
  assertEquals(clampPx(undefined, 220, 220, 1280), 220);
  assertEquals(clampPx('not-a-number', 220, 220, 1280), 220);
  assertEquals(clampPx(640, 220, 220, undefined), 220); // viewport=0 → ceiling<min
});

// --- loadInitial ------------------------------------------------------

Deno.test('loadInitial: storage hit returns the integer (clamped)', () => {
  const s = memStore({ 'ld:v12:splitter': '700' });
  assertEquals(loadInitial(s, 1280), 700);
});

Deno.test('loadInitial: storage hit clamped if out of range for current viewport', () => {
  const s = memStore({ 'ld:v12:splitter': '2000' });
  assertEquals(loadInitial(s, 1280), 1060); // ceiling
  const s2 = memStore({ 'ld:v12:splitter': '50' });
  assertEquals(loadInitial(s2, 1280), 220); // floor
});

Deno.test('loadInitial: storage miss → half the viewport (clamped)', () => {
  const s = memStore();
  assertEquals(loadInitial(s, 1280), 640);
  assertEquals(loadInitial(s, 800), 400);
});

Deno.test('loadInitial: junk in storage → half the viewport', () => {
  const s = memStore({ 'ld:v12:splitter': 'not-a-number' });
  assertEquals(loadInitial(s, 1280), 640);
});

Deno.test('loadInitial: thrown storage.getItem (private mode) → half the viewport', () => {
  const s = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem() {},
    removeItem() {},
  };
  assertEquals(loadInitial(s, 1280), 640);
});

Deno.test('loadInitial: null storage degrades to the viewport-midpoint fallback', () => {
  assertEquals(loadInitial(null, 1280), 640);
  assertEquals(loadInitial(undefined, 1280), 640);
});

// --- v13: storageKey override ----------------------------------------

Deno.test('loadInitial: storageKey arg reads from a different key (v13 piggyback)', () => {
  const s = memStore({
    'ld:v12:splitter': '600',     // v12 horizontal pane width
    'ld:v13:problemsH': '180',    // v13 problems panel height
  });
  // Default key (v12): the horizontal pane width.
  assertEquals(loadInitial(s, 1280), 600);
  // Custom key (v13): the problems height — different value, same
  // helper. Mins differ between axes, so callers pass appropriate
  // mins too.
  assertEquals(
    loadInitial(s, 800, 60, 240, 'ld:v13:problemsH'),
    180,
  );
});
