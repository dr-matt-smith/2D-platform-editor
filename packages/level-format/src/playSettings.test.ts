import { assertEquals } from '@std/assert';
import { meetsPickupRequirement } from './playSettings.ts';

Deno.test('default "all" requires every pickup', () => {
  assertEquals(meetsPickupRequirement(0, 4), false);
  assertEquals(meetsPickupRequirement(3, 4), false);
  assertEquals(meetsPickupRequirement(4, 4), true);
});

Deno.test('explicit "all" same as default', () => {
  assertEquals(meetsPickupRequirement(2, 4, 'all'), false);
  assertEquals(meetsPickupRequirement(4, 4, 'all'), true);
});

Deno.test('"all" on a level with zero pickups is trivially met', () => {
  assertEquals(meetsPickupRequirement(0, 0, 'all'), true);
});

Deno.test('required = 0 → no minimum (touch exit to win)', () => {
  assertEquals(meetsPickupRequirement(0, 4, 0), true);
  assertEquals(meetsPickupRequirement(2, 4, 0), true);
});

Deno.test('required = N → score >= N wins', () => {
  assertEquals(meetsPickupRequirement(0, 4, 2), false);
  assertEquals(meetsPickupRequirement(1, 4, 2), false);
  assertEquals(meetsPickupRequirement(2, 4, 2), true);
  assertEquals(meetsPickupRequirement(3, 4, 2), true);
});

Deno.test('required > total → clamped to total ("all" effectively)', () => {
  // Level has 4 pickups; author asked for 10. Collecting all 4 wins.
  assertEquals(meetsPickupRequirement(3, 4, 10), false);
  assertEquals(meetsPickupRequirement(4, 4, 10), true);
});

Deno.test('required = total → same as "all"', () => {
  assertEquals(meetsPickupRequirement(3, 4, 4), false);
  assertEquals(meetsPickupRequirement(4, 4, 4), true);
});

Deno.test('negative or non-finite required → defensive "all"', () => {
  assertEquals(meetsPickupRequirement(4, 4, -1), true); // negative → 0 path
  assertEquals(meetsPickupRequirement(2, 4, NaN), false); // NaN → fallback all
  assertEquals(meetsPickupRequirement(4, 4, NaN), true);
  assertEquals(meetsPickupRequirement(2, 4, Infinity), false); // !isFinite → all
});
