import { assertEquals } from '@std/assert';
import { Legend } from './Legend.ts';
import { Role } from './Role.ts';

Deno.test('Legend.DEFAULT is the Dirt glyph set', () => {
  assertEquals(Legend.DEFAULT.get('#')?.name, 'Filled'); // Wall → Filled
  assertEquals(Legend.DEFAULT.get('.')?.name, 'Empty');
  assertEquals(Legend.DEFAULT.glyphs(), ['.', '#', 'P', '^', 'o', 'E']);
});

Deno.test('fromLookup maps a lookup glyphs section to a char-keyed legend', () => {
  const lookup = {
    glyphs: {
      empty: { name: 'Void', char: '.', role: 'background', color: '#000' },
      filled: { name: 'Rock', char: '#', role: 'terrain', image: 'tiles/x.png' },
      player: { name: 'Hero', char: '@', role: 'entity' },
    },
  };
  const lg = Legend.fromLookup(lookup);
  assertEquals(lg.get('.'), { name: 'Void', role: Role.Background, image: null, color: '#000' });
  assertEquals(lg.get('#')?.image, 'tiles/x.png');
  assertEquals(lg.get('@')?.name, 'Hero');
  assertEquals(Legend.fromLookup(null), Legend.DEFAULT); // no lookup → fallback
  assertEquals(Legend.fromLookup({}), Legend.DEFAULT);
});

Deno.test('DEFAULT uses the specific roles, not the legacy generic ones', () => {
  assertEquals(Legend.DEFAULT.roleOf('.'), Role.Background);
  assertEquals(Legend.DEFAULT.roleOf('#'), Role.Terrain);
  assertEquals(Legend.DEFAULT.roleOf('P'), Role.Player);
  assertEquals(Legend.DEFAULT.roleOf('^'), Role.Hazard); // legacy data had this as 'terrain'
  assertEquals(Legend.DEFAULT.roleOf('o'), Role.Pickup);
  assertEquals(Legend.DEFAULT.roleOf('E'), Role.Exit);
});

Deno.test('roleOf returns the role for a char in the legend, null otherwise', () => {
  assertEquals(Legend.DEFAULT.roleOf('P'), Role.Player);
  assertEquals(Legend.DEFAULT.roleOf('E'), Role.Exit);
  assertEquals(Legend.DEFAULT.roleOf('?'), null);
  assertEquals(Legend.fromRecord(null).roleOf('P'), null); // empty legend
  assertEquals(Legend.fromRecord(undefined).roleOf('P'), null);
});

Deno.test('fromLookup: legacy lookup (role:"entity") maps to specific roles via key', () => {
  // Mirrors the shape every shipped tile_lookup.json uses (Dirt + the
  // four user packs): the role string is coarse but the KEY is specific.
  const lookup = {
    glyphs: {
      empty: { name: 'Empty', char: '.', role: 'background' },
      filled: { name: 'Filled', char: '#', role: 'terrain' },
      player: { name: 'P', char: 'P', role: 'entity' },
      exit: { name: 'E', char: 'E', role: 'entity' },
      hazard: { name: 'H', char: '^', role: 'terrain' }, // legacy mistype
      pickup: { name: 'p', char: 'o', role: 'entity' },
    },
  };
  const lg = Legend.fromLookup(lookup);
  assertEquals(lg.roleOf('P'), Role.Player);
  assertEquals(lg.roleOf('E'), Role.Exit);
  assertEquals(lg.roleOf('^'), Role.Hazard); // legacy 'terrain' overridden via key
  assertEquals(lg.roleOf('o'), Role.Pickup);
});

Deno.test('fromLookup: new-style key with an explicit role takes the role verbatim', () => {
  const lookup = {
    glyphs: {
      apple: { name: 'Apple', char: 'o', role: 'pickup' },
      cherry: { name: 'Cherry', char: 'O', role: 'pickup' },
      fire: { name: 'Fire', char: '*', role: 'hazard' },
      tree: { name: 'Tree', char: 'T', role: 'decoration' },
    },
  };
  const lg = Legend.fromLookup(lookup);
  assertEquals(lg.roleOf('o'), Role.Pickup);
  assertEquals(lg.roleOf('O'), Role.Pickup);
  assertEquals(lg.roleOf('*'), Role.Hazard);
  assertEquals(lg.roleOf('T'), Role.Decoration);
});

Deno.test('fromLookup: unknown role on a new-style key resolves to Role.Unknown', () => {
  const lg = Legend.fromLookup({ glyphs: { mystery: { name: '?', char: '?', role: 'meeple' } } });
  assertEquals(lg.roleOf('?'), Role.Unknown);
  assertEquals(lg.roleOf('?'), 'unknown');
});

Deno.test('fromLookup: legacy key wins over a deliberately-wrong explicit role', () => {
  // Safety net: a legacy lookup using a legacy key (`player`) but an
  // author who set role to 'hazard' by mistake — we keep the key meaning,
  // not the typo, so the four shipped packs stay robust.
  const lg = Legend.fromLookup({ glyphs: { player: { name: 'P', char: 'P', role: 'hazard' } } });
  assertEquals(lg.roleOf('P'), Role.Player);
});

Deno.test('fromLookup: glyphs without a char are skipped', () => {
  const lg = Legend.fromLookup({ glyphs: { a: { name: 'A', role: 'terrain' }, b: null, c: { char: 'c' } } });
  assertEquals(lg.glyphs(), ['c']);
  assertEquals(lg.get('c'), { name: 'c', role: Role.Unknown, image: null, color: null });
});

Deno.test('has / get / size / glyphsWithRole', () => {
  const lg = Legend.DEFAULT;
  assertEquals(lg.size, 6);
  assertEquals(lg.has('P'), true);
  assertEquals(lg.has('Z'), false);
  assertEquals(lg.get('Z'), undefined);
  assertEquals(lg.has('constructor'), false); // not fooled by Object.prototype
  const fruit = Legend.fromRecord({ o: { role: Role.Pickup }, O: { role: Role.Pickup }, '#': { role: Role.Terrain } });
  assertEquals(fruit.glyphsWithRole(Role.Pickup), ['o', 'O']);
});

Deno.test('a legend is iterable as [glyph, entry] pairs, in legend order', () => {
  const pairs = [...Legend.DEFAULT].map(([g, e]) => `${g}:${e.role}`);
  assertEquals(pairs, ['.:background', '#:terrain', 'P:player', '^:hazard', 'o:pickup', 'E:exit']);
  assertEquals(Legend.DEFAULT.entries().length, 6);
});

Deno.test('fromRecord fills in missing names and images; toRecord round-trips', () => {
  const lg = Legend.fromRecord({ '@': { role: Role.Player } });
  assertEquals(lg.get('@'), { name: '@', role: Role.Player, image: null, color: null });
  const record = Legend.DEFAULT.toRecord();
  assertEquals(record.P.role, Role.Player);
  assertEquals(Legend.fromRecord(record).entries(), Legend.DEFAULT.entries());
});

Deno.test('a legend cannot be changed through toRecord', () => {
  const record = Legend.DEFAULT.toRecord() as Record<string, unknown>;
  let threw = false;
  try {
    record.Z = { role: Role.Hazard };
  } catch {
    threw = true; // modules are strict mode: writing a frozen object throws
  }
  assertEquals(threw, true);
  assertEquals(Legend.DEFAULT.has('Z'), false);
});
