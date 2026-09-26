import { assertEquals } from '@std/assert';
import { PickupRequirement } from './PickupRequirement.ts';
import type { PickupRequired } from './PickupRequirement.ts';

const meets = (score: number, total: number, required?: PickupRequired) =>
  new PickupRequirement(required).isMetBy(score, total);

Deno.test('default "all" requires every pickup', () => {
  assertEquals(meets(0, 4), false);
  assertEquals(meets(3, 4), false);
  assertEquals(meets(4, 4), true);
});

Deno.test('explicit "all" same as default', () => {
  assertEquals(meets(2, 4, 'all'), false);
  assertEquals(meets(4, 4, 'all'), true);
  assertEquals(PickupRequirement.ALL.isMetBy(4, 4), true);
});

Deno.test('"all" on a level with zero pickups is trivially met', () => {
  assertEquals(meets(0, 0, 'all'), true);
});

Deno.test('required = 0 → no minimum (touch exit to win)', () => {
  assertEquals(meets(0, 4, 0), true);
  assertEquals(meets(2, 4, 0), true);
});

Deno.test('required = N → score >= N wins', () => {
  assertEquals(meets(0, 4, 2), false);
  assertEquals(meets(1, 4, 2), false);
  assertEquals(meets(2, 4, 2), true);
  assertEquals(meets(3, 4, 2), true);
});

Deno.test('required > total → clamped to total ("all" effectively)', () => {
  // Level has 4 pickups; author asked for 10. Collecting all 4 wins.
  assertEquals(meets(3, 4, 10), false);
  assertEquals(meets(4, 4, 10), true);
});

Deno.test('required = total → same as "all"', () => {
  assertEquals(meets(3, 4, 4), false);
  assertEquals(meets(4, 4, 4), true);
});

Deno.test('negative or non-finite required → defensive "all"', () => {
  assertEquals(meets(4, 4, -1), true); // negative → 0 path
  assertEquals(meets(2, 4, NaN), false); // NaN → fallback all
  assertEquals(meets(4, 4, NaN), true);
  assertEquals(meets(2, 4, Infinity), false); // !isFinite → all
});

Deno.test('parseValue reads "all" or a whole number, else null', () => {
  assertEquals(PickupRequirement.parseValue('all'), 'all');
  assertEquals(PickupRequirement.parseValue(' ALL '), 'all');
  assertEquals(PickupRequirement.parseValue('0'), 0);
  assertEquals(PickupRequirement.parseValue('12'), 12);
  assertEquals(PickupRequirement.parseValue('-1'), null);
  assertEquals(PickupRequirement.parseValue('two'), null);
});

Deno.test('directiveValue is null for the default or an invalid count', () => {
  assertEquals(PickupRequirement.ALL.directiveValue(), null);
  assertEquals(new PickupRequirement(0).directiveValue(), '0');
  assertEquals(new PickupRequirement(3).directiveValue(), '3');
  assertEquals(new PickupRequirement(-1).directiveValue(), null);
  assertEquals(new PickupRequirement(2.5).directiveValue(), null);
});
