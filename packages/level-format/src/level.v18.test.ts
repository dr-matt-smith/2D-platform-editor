import { assertEquals, assertMatch } from '@std/assert';
import {
  parse,
  serialize,
  setBackgroundImageDirective,
  setPickupRequiredDirective,
} from './level.ts';

const GRID = '#####\n#P.E#\n#####';

// --- parse: new directives -------------------------------------------

Deno.test('parse: meta.backgroundImage defaults to null, meta.pickupRequired to "all"', () => {
  const p = parse(GRID);
  assertEquals(p.meta.backgroundImage, null);
  assertEquals(p.meta.pickupRequired, 'all');
});

Deno.test('parse: # background-image: <id> populates meta.backgroundImage', () => {
  const p = parse(`# background-image: bg-blue-clouds\n${GRID}`);
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
});

Deno.test('parse: # pickup-required: 0 / N / all', () => {
  assertEquals(parse(`# pickup-required: 0\n${GRID}`).meta.pickupRequired, 0);
  assertEquals(parse(`# pickup-required: 3\n${GRID}`).meta.pickupRequired, 3);
  assertEquals(parse(`# pickup-required: all\n${GRID}`).meta.pickupRequired, 'all');
});

Deno.test('parse: malformed # pickup-required falls back to default "all"', () => {
  assertEquals(parse(`# pickup-required: nope\n${GRID}`).meta.pickupRequired, 'all');
  assertEquals(parse(`# pickup-required: -1\n${GRID}`).meta.pickupRequired, 'all');
});

// --- serialize: round-trip -------------------------------------------

Deno.test('serialize round-trips background + pickup-required when set', () => {
  const text =
    `# name: t\n# background-image: bg-blue-clouds\n# pickup-required: 2\n${GRID}`;
  const parsed = parse(text);
  const out = serialize(parsed);
  // The header order in serialize may differ; what matters is that
  // re-parsing the serialized text yields the same meta.
  const round = parse(out);
  assertEquals(round.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(round.meta.pickupRequired, 2);
  assertEquals(round.meta.name, 't');
});

Deno.test('serialize omits the new directives when set to defaults', () => {
  const parsed = parse(`# name: t\n${GRID}`);
  const out = serialize(parsed);
  assertEquals(/background-image/.test(out), false);
  assertEquals(/pickup-required/.test(out), false);
});

// --- setBackgroundImageDirective -------------------------------------

Deno.test('setBackgroundImageDirective: insert when absent', () => {
  const t = setBackgroundImageDirective(`# name: a\n${GRID}`, 'bg-blue-clouds');
  assertMatch(t, /# background-image: bg-blue-clouds/);
  assertEquals(parse(t).meta.backgroundImage, 'bg-blue-clouds');
});

Deno.test('setBackgroundImageDirective: replace in place', () => {
  const t = setBackgroundImageDirective(
    `# background-image: oldOne\n${GRID}`,
    'newOne',
  );
  assertEquals(parse(t).meta.backgroundImage, 'newOne');
  // No duplicate line.
  assertEquals(t.match(/background-image/g)!.length, 1);
});

Deno.test('setBackgroundImageDirective: null / "" removes the line', () => {
  const t1 = setBackgroundImageDirective(
    `# background-image: bg\n${GRID}`,
    null,
  );
  assertEquals(parse(t1).meta.backgroundImage, null);
  assertEquals(/background-image/.test(t1), false);

  const t2 = setBackgroundImageDirective(`# background-image: bg\n${GRID}`, '');
  assertEquals(parse(t2).meta.backgroundImage, null);
});

// --- setPickupRequiredDirective --------------------------------------

Deno.test('setPickupRequiredDirective: 0 inserts the line; round-trips to number', () => {
  const t = setPickupRequiredDirective(GRID, 0);
  assertMatch(t, /# pickup-required: 0/);
  assertEquals(parse(t).meta.pickupRequired, 0);
});

Deno.test('setPickupRequiredDirective: positive integer round-trips', () => {
  const t = setPickupRequiredDirective(GRID, 5);
  assertEquals(parse(t).meta.pickupRequired, 5);
});

Deno.test('setPickupRequiredDirective: "all" or null removes the line (default)', () => {
  const t1 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, 'all');
  assertEquals(parse(t1).meta.pickupRequired, 'all');
  assertEquals(/pickup-required/.test(t1), false);

  const t2 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, null);
  assertEquals(parse(t2).meta.pickupRequired, 'all');
});

Deno.test('setPickupRequiredDirective: negative / non-integer rejected (treated as "all" — remove)', () => {
  const t1 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, -1);
  assertEquals(parse(t1).meta.pickupRequired, 'all');
  const t2 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, 2.5);
  assertEquals(parse(t2).meta.pickupRequired, 'all');
});

Deno.test('directives play nicely with other headers (preserve order, no duplication)', () => {
  let t = `# name: tut\n# tileset: PlayWithYourPeas\n# size: 5x3\n${GRID}`;
  t = setBackgroundImageDirective(t, 'bg-blue-clouds');
  t = setPickupRequiredDirective(t, 2);
  const p = parse(t);
  assertEquals(p.meta.name, 'tut');
  assertEquals(p.meta.tileset, 'PlayWithYourPeas');
  assertEquals(p.meta.declared, { w: 5, h: 3 });
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(p.meta.pickupRequired, 2);
});
