import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meetsPickupRequirement } from './playSettings.js';

test('default "all" requires every pickup', () => {
  assert.equal(meetsPickupRequirement(0, 4), false);
  assert.equal(meetsPickupRequirement(3, 4), false);
  assert.equal(meetsPickupRequirement(4, 4), true);
});

test('explicit "all" same as default', () => {
  assert.equal(meetsPickupRequirement(2, 4, 'all'), false);
  assert.equal(meetsPickupRequirement(4, 4, 'all'), true);
});

test('"all" on a level with zero pickups is trivially met', () => {
  assert.equal(meetsPickupRequirement(0, 0, 'all'), true);
});

test('required = 0 → no minimum (touch exit to win)', () => {
  assert.equal(meetsPickupRequirement(0, 4, 0), true);
  assert.equal(meetsPickupRequirement(2, 4, 0), true);
});

test('required = N → score >= N wins', () => {
  assert.equal(meetsPickupRequirement(0, 4, 2), false);
  assert.equal(meetsPickupRequirement(1, 4, 2), false);
  assert.equal(meetsPickupRequirement(2, 4, 2), true);
  assert.equal(meetsPickupRequirement(3, 4, 2), true);
});

test('required > total → clamped to total ("all" effectively)', () => {
  // Level has 4 pickups; author asked for 10. Collecting all 4 wins.
  assert.equal(meetsPickupRequirement(3, 4, 10), false);
  assert.equal(meetsPickupRequirement(4, 4, 10), true);
});

test('required = total → same as "all"', () => {
  assert.equal(meetsPickupRequirement(3, 4, 4), false);
  assert.equal(meetsPickupRequirement(4, 4, 4), true);
});

test('negative or non-finite required → defensive "all"', () => {
  assert.equal(meetsPickupRequirement(4, 4, -1), true); // negative → 0 path
  assert.equal(meetsPickupRequirement(2, 4, NaN), false); // NaN → fallback all
  assert.equal(meetsPickupRequirement(4, 4, NaN), true);
  assert.equal(meetsPickupRequirement(2, 4, Infinity), false); // !isFinite → all
});
