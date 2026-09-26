import { assert, assertEquals, assertInstanceOf } from '@std/assert';
import { DrawSpec } from './DrawSpec.ts';
import { SpriteAnimation } from './SpriteAnimation.ts';
import { SpriteStrip } from './SpriteStrip.ts';

// A stub image with just the size the strip reads.
const image = (width: number, height = 32) => ({ width, height }) as unknown as HTMLImageElement;

Deno.test('SpriteStrip: frame width is the image width over the frame count', () => {
  const strip = new SpriteStrip(image(352), 11);
  assertEquals(strip.frames, 11);
  assertEquals(strip.frameWidth, 32);
});

Deno.test('SpriteStrip: missing or < 1 frames means a single whole-image frame', () => {
  for (const frames of [null, 0, -3, 1]) {
    const strip = new SpriteStrip(image(40, 20), frames);
    assertEquals(strip.frames, 1);
    const spec = strip.frame(0);
    assertEquals([spec.sx, spec.sy, spec.sw, spec.sh], [0, 0, 40, 20]);
  }
});

Deno.test('SpriteStrip.frame(i) crops frame i', () => {
  const spec = new SpriteStrip(image(128), 4).frame(2);
  assertEquals([spec.sx, spec.sy, spec.sw, spec.sh], [64, 0, 32, 32]);
});

Deno.test('SpriteStrip.toSprite: one frame, `frame: i` and `fps: 0` give a still DrawSpec', () => {
  assertInstanceOf(new SpriteStrip(image(32), 1).toSprite(), DrawSpec);
  const fixed = new SpriteStrip(image(128), 4).toSprite(3);
  assertInstanceOf(fixed, DrawSpec);
  assertEquals(fixed.frameAt(0).sx, 96);
  assertInstanceOf(new SpriteStrip(image(128), 4).toSprite(null, 0), DrawSpec);
});

Deno.test('SpriteStrip.toSprite: several frames and no `frame` give an animation at 10 fps', () => {
  const sprite = new SpriteStrip(image(128), 4).toSprite();
  assertInstanceOf(sprite, SpriteAnimation);
  assertEquals(sprite.fps, SpriteStrip.DEFAULT_FPS);
  assertEquals(SpriteStrip.DEFAULT_FPS, 10);
});

Deno.test('SpriteStrip.toSprite: out-of-range `frame` falls back to frame 0', () => {
  assertEquals(new SpriteStrip(image(128), 4).toSprite(99).frameAt().sx, 0);
});

Deno.test('SpriteAnimation.frameAt picks the frame from the time and loops', () => {
  const anim = new SpriteAnimation(new SpriteStrip(image(128), 4), 25); // 40 ms per frame
  assertEquals(anim.frameAt(0).sx, 0);
  assertEquals(anim.frameAt(40).sx, 32);
  assertEquals(anim.frameAt(159).sx, 96);
  assertEquals(anim.frameAt(160).sx, 0);
  // Missing, negative and NaN times all mean frame 0.
  assertEquals(anim.frameAt().sx, 0);
  assertEquals(anim.frameAt(-5).sx, 0);
  assertEquals(anim.frameAt(NaN).sx, 0);
});

Deno.test('DrawSpec: whole() covers the image; frameAt returns itself; draw passes all 9 args', () => {
  const im = image(20, 10);
  const spec = DrawSpec.whole(im);
  assertEquals([spec.sx, spec.sy, spec.sw, spec.sh], [0, 0, 20, 10]);
  assert(spec.frameAt(1234) === spec);
  const calls: unknown[][] = [];
  const ctx = { drawImage: (...a: unknown[]) => calls.push(a) } as unknown as CanvasRenderingContext2D;
  new DrawSpec(im, 4, 0, 8, 10).draw(ctx, 1, 2, 24);
  assertEquals(calls, [[im, 4, 0, 8, 10, 1, 2, 24, 24]]);
});
