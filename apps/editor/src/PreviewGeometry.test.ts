import { assertEquals } from '@std/assert';
import { Level } from '@2d-platform/level-format';
import { PreviewGeometry } from './PreviewGeometry.ts';

const geo = new PreviewGeometry(24, 24);
// A 10×5-cell canvas (plus the HUD band) shown at its natural size.
const W = 240;
const H = 5 * 24 + 24;
const box = { left: 100, top: 50, width: W, height: H };

Deno.test('cellAt maps a pointer below the HUD band to its cell', () => {
  // x = 3.5 cells, y = HUD + 2.5 cells
  assertEquals(geo.cellAt(100 + 84, 50 + 24 + 60, box, W, H), { cx: 3, cy: 2, inHud: false });
});

Deno.test('cellAt flags the HUD band and clamps to row 0', () => {
  assertEquals(geo.cellAt(100 + 10, 50 + 10, box, W, H), { cx: 0, cy: 0, inHud: true });
});

Deno.test('cellAt undoes CSS scaling (Fit mode)', () => {
  const scaled = { left: 0, top: 0, width: W * 2, height: H * 2 };
  // Twice the size on screen → the same cell at twice the pointer offset.
  assertEquals(geo.cellAt(2 * 84, 2 * (24 + 60), scaled, W, H), { cx: 3, cy: 2, inHud: false });
});

Deno.test('cellAt clamps pointers outside the canvas to the edge cells', () => {
  assertEquals(geo.cellAt(10_000, 10_000, box, W, H), { cx: 9, cy: 4, inHud: false });
});

Deno.test('cellRect covers both corners in any order, below the HUD', () => {
  const a = { cx: 4, cy: 3, inHud: false };
  const b = { cx: 1, cy: 1, inHud: false };
  assertEquals(geo.cellRect(a, b), { x: 24, y: 24 + 24, w: 4 * 24, h: 3 * 24 });
});

Deno.test('viewportRect is null without a # viewport: directive', () => {
  assertEquals(geo.viewportRect(Level.parse('#####\n#P.E#\n#####')), null);
});

Deno.test('viewportRect centres on the spawn, clamped to the world', () => {
  const row = '.'.repeat(30);
  const text = ['# viewport: 10x4', row, row, `${'.'.repeat(20)}P${'.'.repeat(9)}`, row, row, row].join('\n');
  // Spawn at col 20, row 2: x = (20 - 5) * 24; y = max(0, 2 - 2) * 24 + HUD.
  assertEquals(geo.viewportRect(Level.parse(text)), { x: 15 * 24, y: 24, w: 240, h: 96 });
});

Deno.test('playPin uses the viewport, else the whole world, plus the HUD', () => {
  assertEquals(geo.playPin(Level.parse('#####\n#P.E#\n#####')), { cssW: 5 * 24, cssH: 3 * 24 + 24 });
  const row = '.'.repeat(30);
  assertEquals(geo.playPin(Level.parse(`# viewport: 10x4\n${row}\n${row}`)), { cssW: 240, cssH: 4 * 24 + 24 });
});

Deno.test('fitScale keeps the aspect ratio (the tighter side wins)', () => {
  assertEquals(PreviewGeometry.fitScale(400, 100, 200, 100), 1);
  assertEquals(PreviewGeometry.fitScale(400, 400, 200, 100), 2);
});
