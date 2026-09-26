import { assertAlmostEquals, assertEquals } from '@std/assert';
import { SolutionOverlay } from './SolutionOverlay.ts';
import type { OverlaySolution } from './SolutionOverlay.ts';

// A context that records the calls and property writes the overlay makes.
function recordingContext() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (_t, name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.join(',')})`); },
    set: (_t, name: string, value: unknown) => { calls.push(`${name}=${value}`); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const walk = (startC: number, targetC: number, goals: string[] = [`0,${targetC}`]): OverlaySolution => ({
  plan: {
    graph: { start: { r: 0, c: startC } } as never,
    goals,
    trace: [{ kind: 'walk', target: { r: 0, c: targetC } } as never],
  },
});

Deno.test('HUE_PALETTE has 5 distinct hues, the first the single-path yellow', () => {
  assertEquals(SolutionOverlay.HUE_PALETTE.length, 5);
  assertEquals(new Set(SolutionOverlay.HUE_PALETTE).size, 5);
  assertEquals(SolutionOverlay.HUE_PALETTE[0], '#ffcc00');
});

Deno.test('paint draws from the start cell centre to the target, then S and E', () => {
  const { ctx, calls } = recordingContext();
  new SolutionOverlay(ctx, 20).paint(walk(1, 4));
  assertEquals(calls.includes('moveTo(30,10)'), true);
  assertEquals(calls.includes('lineTo(90,10)'), true);
  assertEquals(calls.filter((c) => c.startsWith('fillText(')), ['fillText(S,30,10)', 'fillText(E,90,10)']);
});

Deno.test('paint shifts everything down by yOffset', () => {
  const { ctx, calls } = recordingContext();
  new SolutionOverlay(ctx, 20, 24).paint(walk(1, 4));
  assertEquals(calls.includes('translate(0,24)'), true);
});

Deno.test('paint does nothing for an empty plan', () => {
  const { ctx, calls } = recordingContext();
  new SolutionOverlay(ctx, 20).paint({ plan: null });
  new SolutionOverlay(ctx, 20).paint(null);
  assertEquals(calls, []);
});

Deno.test('paintAll paints the focused solution last, at full opacity', () => {
  const { ctx, calls } = recordingContext();
  new SolutionOverlay(ctx, 20).paintAll([walk(1, 4), walk(1, 6)], 0);
  const alphas = calls.filter((c) => c.startsWith('globalAlpha='));
  assertEquals(alphas, ['globalAlpha=0.35', 'globalAlpha=1']);
});

Deno.test('arc ends at the target and peaks a tile above the higher end', () => {
  const pts = SolutionOverlay.arc(0, 100, 60, 100, 20);
  assertEquals(pts.length, 6);
  assertEquals(pts[5], { x: 60, y: 100 });
  // Midway (t = 0.5) the curve is halfway to the control point: y = 100 - 10.
  assertAlmostEquals(pts[2].y, 90);
});
