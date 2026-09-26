import { assertEquals } from '@std/assert';
import { FallbackShape } from './FallbackShape.ts';
import { FallbackStyle } from './FallbackStyle.ts';

// Fake ctx that logs each call by name with its arguments, and the
// fill colour in force.
function loggingCtx() {
  const log: unknown[][] = [];
  const record = (name: string) => (...args: unknown[]) => log.push([name, ...args]);
  const ctx = {
    fillStyle: '',
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    fill: record('fill'),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log, raw: ctx };
}

Deno.test('FallbackStyle: block fills the cell in its colour', () => {
  const { ctx, log, raw } = loggingCtx();
  new FallbackStyle('#123456', FallbackShape.Block).draw(ctx, 10, 20, 8);
  assertEquals(raw.fillStyle, '#123456');
  assertEquals(log, [['fillRect', 10, 20, 8, 8]]);
});

Deno.test('FallbackStyle: disc and pip are centred circles of 0.4 and 0.18 × size', () => {
  const disc = loggingCtx();
  new FallbackStyle('#fff', FallbackShape.Disc).draw(disc.ctx, 0, 0, 10);
  assertEquals(disc.log[1], ['arc', 5, 5, 4, 0, Math.PI * 2]);
  const pip = loggingCtx();
  new FallbackStyle('#fff', FallbackShape.Pip).draw(pip.ctx, 0, 0, 100);
  assertEquals(pip.log[1], ['arc', 50, 50, 18, 0, Math.PI * 2]);
});
