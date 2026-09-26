import { assertEquals } from '@std/assert';
import { Aabb } from './Aabb.ts';
import { Axis } from './Axis.ts';

const SOLID = { x: 100, y: 100, w: 20, h: 20 };

Deno.test('overlaps: true for intersecting boxes, in either order', () => {
  const a = { x: 110, y: 110, w: 20, h: 20 };
  assertEquals(Aabb.overlaps(a, SOLID), true);
  assertEquals(Aabb.overlaps(SOLID, a), true);
});

Deno.test('overlaps: boxes that only touch edges do not overlap', () => {
  assertEquals(Aabb.overlaps({ x: 120, y: 100, w: 20, h: 20 }, SOLID), false);
  assertEquals(Aabb.overlaps({ x: 100, y: 80, w: 20, h: 20 }, SOLID), false);
});

Deno.test('resolveAxis: null when there is no overlap', () => {
  assertEquals(Aabb.resolveAxis({ x: 0, y: 0, w: 20, h: 20 }, SOLID, Axis.X), null);
});

Deno.test('resolveAxis x: pushed out on the side its centre is nearer', () => {
  // Centre left of the solid's centre → pushed to the left face.
  assertEquals(Aabb.resolveAxis({ x: 85, y: 100, w: 20, h: 20 }, SOLID, Axis.X), 80);
  // Centre right of it → pushed to the right face.
  assertEquals(Aabb.resolveAxis({ x: 115, y: 100, w: 20, h: 20 }, SOLID, Axis.X), 120);
});

Deno.test('resolveAxis y: pushed onto the top or below the bottom', () => {
  assertEquals(Aabb.resolveAxis({ x: 100, y: 85, w: 20, h: 20 }, SOLID, Axis.Y), 80);
  assertEquals(Aabb.resolveAxis({ x: 100, y: 115, w: 20, h: 20 }, SOLID, Axis.Y), 120);
});
