import { assertEquals } from '@std/assert';
import { isKnownRole, KNOWN_ROLES, Role } from './Role.ts';

Deno.test('KNOWN_ROLES is the locked role taxonomy', () => {
  // Seven roles, plus "foreground" for decoration glyphs drawn OVER the
  // entities. The values are the strings used in tile_lookup.json.
  assertEquals(
    [...KNOWN_ROLES].sort(),
    ['background', 'decoration', 'exit', 'foreground', 'hazard', 'pickup', 'player', 'terrain'],
  );
});

Deno.test('Role.Unknown is a Role but not a declarable one', () => {
  assertEquals(Role.Unknown, 'unknown');
  assertEquals(KNOWN_ROLES.has(Role.Unknown), false);
});

Deno.test('isKnownRole accepts only the declarable role strings', () => {
  assertEquals(isKnownRole('pickup'), true);
  assertEquals(isKnownRole('foreground'), true);
  assertEquals(isKnownRole('unknown'), false);
  assertEquals(isKnownRole('entity'), false); // legacy coarse name
  assertEquals(isKnownRole(undefined), false);
  assertEquals(isKnownRole(3), false);
});
