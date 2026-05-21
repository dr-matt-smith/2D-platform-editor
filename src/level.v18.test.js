import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  serialize,
  setBackgroundImageDirective,
  setPickupRequiredDirective,
} from './level.js';

const GRID = '#####\n#P.E#\n#####';

// --- parse: new directives -------------------------------------------

test('parse: meta.backgroundImage defaults to null, meta.pickupRequired to "all"', () => {
  const p = parse(GRID);
  assert.equal(p.meta.backgroundImage, null);
  assert.equal(p.meta.pickupRequired, 'all');
});

test('parse: # background-image: <id> populates meta.backgroundImage', () => {
  const p = parse(`# background-image: bg-blue-clouds\n${GRID}`);
  assert.equal(p.meta.backgroundImage, 'bg-blue-clouds');
});

test('parse: # pickup-required: 0 / N / all', () => {
  assert.equal(parse(`# pickup-required: 0\n${GRID}`).meta.pickupRequired, 0);
  assert.equal(parse(`# pickup-required: 3\n${GRID}`).meta.pickupRequired, 3);
  assert.equal(parse(`# pickup-required: all\n${GRID}`).meta.pickupRequired, 'all');
});

test('parse: malformed # pickup-required falls back to default "all"', () => {
  assert.equal(parse(`# pickup-required: nope\n${GRID}`).meta.pickupRequired, 'all');
  assert.equal(parse(`# pickup-required: -1\n${GRID}`).meta.pickupRequired, 'all');
});

// --- serialize: round-trip -------------------------------------------

test('serialize round-trips background + pickup-required when set', () => {
  const text =
    `# name: t\n# background-image: bg-blue-clouds\n# pickup-required: 2\n${GRID}`;
  const parsed = parse(text);
  const out = serialize(parsed);
  // The header order in serialize may differ; what matters is that
  // re-parsing the serialized text yields the same meta.
  const round = parse(out);
  assert.equal(round.meta.backgroundImage, 'bg-blue-clouds');
  assert.equal(round.meta.pickupRequired, 2);
  assert.equal(round.meta.name, 't');
});

test('serialize omits the new directives when set to defaults', () => {
  const parsed = parse(`# name: t\n${GRID}`);
  const out = serialize(parsed);
  assert.equal(/background-image/.test(out), false);
  assert.equal(/pickup-required/.test(out), false);
});

// --- setBackgroundImageDirective -------------------------------------

test('setBackgroundImageDirective: insert when absent', () => {
  const t = setBackgroundImageDirective(`# name: a\n${GRID}`, 'bg-blue-clouds');
  assert.match(t, /# background-image: bg-blue-clouds/);
  assert.equal(parse(t).meta.backgroundImage, 'bg-blue-clouds');
});

test('setBackgroundImageDirective: replace in place', () => {
  const t = setBackgroundImageDirective(
    `# background-image: oldOne\n${GRID}`,
    'newOne',
  );
  assert.equal(parse(t).meta.backgroundImage, 'newOne');
  // No duplicate line.
  assert.equal(t.match(/background-image/g).length, 1);
});

test('setBackgroundImageDirective: null / "" removes the line', () => {
  const t1 = setBackgroundImageDirective(
    `# background-image: bg\n${GRID}`,
    null,
  );
  assert.equal(parse(t1).meta.backgroundImage, null);
  assert.equal(/background-image/.test(t1), false);

  const t2 = setBackgroundImageDirective(`# background-image: bg\n${GRID}`, '');
  assert.equal(parse(t2).meta.backgroundImage, null);
});

// --- setPickupRequiredDirective --------------------------------------

test('setPickupRequiredDirective: 0 inserts the line; round-trips to number', () => {
  const t = setPickupRequiredDirective(GRID, 0);
  assert.match(t, /# pickup-required: 0/);
  assert.equal(parse(t).meta.pickupRequired, 0);
});

test('setPickupRequiredDirective: positive integer round-trips', () => {
  const t = setPickupRequiredDirective(GRID, 5);
  assert.equal(parse(t).meta.pickupRequired, 5);
});

test('setPickupRequiredDirective: "all" or null removes the line (default)', () => {
  const t1 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, 'all');
  assert.equal(parse(t1).meta.pickupRequired, 'all');
  assert.equal(/pickup-required/.test(t1), false);

  const t2 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, null);
  assert.equal(parse(t2).meta.pickupRequired, 'all');
});

test('setPickupRequiredDirective: negative / non-integer rejected (treated as "all" — remove)', () => {
  const t1 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, -1);
  assert.equal(parse(t1).meta.pickupRequired, 'all');
  const t2 = setPickupRequiredDirective(`# pickup-required: 3\n${GRID}`, 2.5);
  assert.equal(parse(t2).meta.pickupRequired, 'all');
});

test('directives play nicely with other headers (preserve order, no duplication)', () => {
  let t = `# name: tut\n# tileset: PlayWithYourPeas\n# size: 5x3\n${GRID}`;
  t = setBackgroundImageDirective(t, 'bg-blue-clouds');
  t = setPickupRequiredDirective(t, 2);
  const p = parse(t);
  assert.equal(p.meta.name, 'tut');
  assert.equal(p.meta.tileset, 'PlayWithYourPeas');
  assert.deepEqual(p.meta.declared, { w: 5, h: 3 });
  assert.equal(p.meta.backgroundImage, 'bg-blue-clouds');
  assert.equal(p.meta.pickupRequired, 2);
});
