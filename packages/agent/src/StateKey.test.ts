import { assertEquals, assertThrows } from '@std/assert';
import { StateKey } from './StateKey.ts';
import { XOffsetBucket } from './XOffsetBucket.ts';

const TILE = 20;

// Compare a key by its parts.
const parts = (k: StateKey) => ({ r: k.r, c: k.c, vxBucket: k.vxBucket, xOffsetBucket: k.xOffsetBucket });

Deno.test('StateKey.of + vxBucketOf + parse helpers', () => {
  assertEquals(StateKey.of(5, 7, 0, XOffsetBucket.Left).toString(), '5,7,0,L');
  assertEquals(StateKey.of(5, 7, -1, XOffsetBucket.Left).toString(), '5,7,-1,L');
  assertEquals(StateKey.of(5, 7, +1, XOffsetBucket.Left).toString(), '5,7,1,L');
  assertEquals(StateKey.vxBucketOf(0), 0);
  assertEquals(StateKey.vxBucketOf(-240), -1);
  assertEquals(StateKey.vxBucketOf(+240), 1);
  assertEquals(StateKey.vxBucketOf(15), 0); // |vx| < 30 → still
  assertEquals(parts(StateKey.parse('5,7,1,L')), { r: 5, c: 7, vxBucket: 1, xOffsetBucket: XOffsetBucket.Left });
  assertEquals(StateKey.VX_BUCKETS, [-1, 0, 1]);
});

Deno.test('xOffsetBucketOf splits a cell into L/C/R thirds', () => {
  assertEquals(StateKey.xOffsetBucketOf(0), XOffsetBucket.Left);
  assertEquals(StateKey.xOffsetBucketOf(TILE / 6), XOffsetBucket.Left);
  assertEquals(StateKey.xOffsetBucketOf(TILE / 3 - 0.01), XOffsetBucket.Left);
  assertEquals(StateKey.xOffsetBucketOf(TILE / 3), XOffsetBucket.Centre);
  assertEquals(StateKey.xOffsetBucketOf(TILE / 2), XOffsetBucket.Centre);
  assertEquals(StateKey.xOffsetBucketOf((2 * TILE) / 3 - 0.01), XOffsetBucket.Centre);
  assertEquals(StateKey.xOffsetBucketOf((2 * TILE) / 3), XOffsetBucket.Right);
  assertEquals(StateKey.xOffsetBucketOf(TILE - 0.01), XOffsetBucket.Right);
  // Wrap into next cell — sub-pixel should reset.
  assertEquals(StateKey.xOffsetBucketOf(TILE), XOffsetBucket.Left);
  assertEquals(StateKey.xOffsetBucketOf(TILE + 1), XOffsetBucket.Left);
  assertEquals(StateKey.X_OFFSET_BUCKETS.map(String), ['L', 'C', 'R']);
});

Deno.test('StateKey text is 4-part; parse round-trips', () => {
  assertEquals(StateKey.of(5, 7).toString(), '5,7,0,L');
  assertEquals(StateKey.of(5, 7, -1, XOffsetBucket.Right).toString(), '5,7,-1,R');
  assertEquals(parts(StateKey.parse('5,7,1,C')), { r: 5, c: 7, vxBucket: 1, xOffsetBucket: XOffsetBucket.Centre });
  assertEquals(StateKey.parse('5,7,-1,R').toString(), '5,7,-1,R');
  assertEquals(StateKey.of(5, 7, 0, XOffsetBucket.Left).toString().split(',').length, 4);
});

Deno.test('StateKey.parse rejects text that is not a state key', () => {
  assertThrows(() => StateKey.parse('5,7'), Error, 'not a state key');
  assertThrows(() => StateKey.parse('5,7,0,Q'), Error, 'not a state key');
});

Deno.test('bucketCentreX picks bucket representatives within their thirds', () => {
  const c = 5;
  const lx = StateKey.bucketCentreX(c, XOffsetBucket.Left);
  const cx = StateKey.bucketCentreX(c, XOffsetBucket.Centre);
  const rx = StateKey.bucketCentreX(c, XOffsetBucket.Right);
  // Each representative must land in its own bucket — a round-trip check.
  assertEquals(StateKey.xOffsetBucketOf(lx), XOffsetBucket.Left);
  assertEquals(StateKey.xOffsetBucketOf(cx), XOffsetBucket.Centre);
  assertEquals(StateKey.xOffsetBucketOf(rx), XOffsetBucket.Right);
  // The left bucket is the cell's left edge exactly (sub-pixel 0).
  assertEquals(lx, 5 * 20);
});

Deno.test('StateKey.ofState: cell under the AABB centre, plus both buckets', () => {
  assertEquals(StateKey.ofState({ x: 20, y: 40, vx: 0, vy: 0, onGround: true }).toString(), '2,1,0,L');
  assertEquals(StateKey.ofState({ x: 28, y: 40, vx: 240, vy: 0, onGround: true }).toString(), '2,1,1,C');
  assertEquals(StateKey.ofState({ x: 35, y: 40, vx: -240, vy: 0, onGround: true }).toString(), '2,2,-1,R');
});

Deno.test('StateKey.cell is the key\'s cell', () => {
  assertEquals(StateKey.parse('3,4,1,C').cell, { r: 3, c: 4 });
});
