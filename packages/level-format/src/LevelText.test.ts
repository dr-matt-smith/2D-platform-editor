import { assertEquals, assertMatch } from '@std/assert';
import { Level } from './Level.ts';
import { LevelText } from './LevelText.ts';
import type { Dimensions } from './LevelData.ts';

const grid = '########\n#P....E#\n########';
const GRID = '#####\n#P.E#\n#####';

const setTileset = (text: string, id: string) => new LevelText(text).setTileset(id).toString();
const setBackgroundImage = (text: string, id: string | null) => new LevelText(text).setBackgroundImage(id).toString();
const setPickupRequired = (text: string, v: 'all' | number | null) => new LevelText(text).setPickupRequired(v).toString();
const setViewport = (text: string, v: Dimensions | 'fit' | null) => new LevelText(text).setViewport(v).toString();
const parse = (text: string) => Level.parse(text);

// --- setTileset -----------------------------------------------------------

Deno.test('non-default tileset: inserts directive after existing headers', () => {
  const t = setTileset(`# name: a\n# size: 8x3\n${grid}`, 'Pixel Adventure 1');
  assertEquals(t, `# name: a\n# size: 8x3\n# tileset: Pixel Adventure 1\n${grid}`);
  // re-parse: meta picks it up.
  assertEquals(parse(t).meta.tileset, 'Pixel Adventure 1');
});

Deno.test('non-default tileset on a header-less level: inserts at the very top', () => {
  assertEquals(setTileset(grid, 'PlayWithYourPeas'), `# tileset: PlayWithYourPeas\n${grid}`);
});

Deno.test('non-default tileset: rewrites an existing directive in place', () => {
  const t = setTileset(`# tileset: Pixel Adventure 1\n${grid}`, 'Treasure Hunters');
  assertEquals(t, `# tileset: Treasure Hunters\n${grid}`);
});

Deno.test('switching back to the default removes the directive', () => {
  const t = setTileset(`# name: a\n# tileset: Pixel Adventure 1\n${grid}`, Level.DEFAULT_TILESET);
  assertEquals(t, `# name: a\n${grid}`);
  assertEquals(parse(t).meta.tileset, Level.DEFAULT_TILESET);
});

Deno.test('default on a level without a directive is a no-op', () => {
  const text = `# name: a\n${grid}`;
  assertEquals(setTileset(text, Level.DEFAULT_TILESET), text);
});

Deno.test('respects // comments in the header region (inserts after them)', () => {
  const t = setTileset(`# name: a\n// hand-edit note\n${grid}`, 'PlayWithYourPeas');
  assertEquals(t, `# name: a\n// hand-edit note\n# tileset: PlayWithYourPeas\n${grid}`);
});

Deno.test('tileset ids with spaces round-trip through Level.parse()', () => {
  assertEquals(parse(setTileset(grid, 'Treasure Hunters')).meta.tileset, 'Treasure Hunters');
});

Deno.test('setTileset: an explicit defaultId decides which id removes the line', () => {
  const t = new LevelText(`# tileset: Neon_Set\n${grid}`).setTileset('Neon_Set', 'Neon_Set');
  assertEquals(t.toString(), grid);
});

// --- setBackgroundImage ---------------------------------------------------

Deno.test('setBackgroundImage: insert when absent', () => {
  const t = setBackgroundImage(`# name: a\n${GRID}`, 'bg-blue-clouds');
  assertMatch(t, /# background-image: bg-blue-clouds/);
  assertEquals(parse(t).meta.backgroundImage, 'bg-blue-clouds');
});

Deno.test('setBackgroundImage: replace in place', () => {
  const t = setBackgroundImage(`# background-image: oldOne\n${GRID}`, 'newOne');
  assertEquals(parse(t).meta.backgroundImage, 'newOne');
  // No duplicate line.
  assertEquals(t.match(/background-image/g)!.length, 1);
});

Deno.test('setBackgroundImage: null / "" removes the line', () => {
  const t1 = setBackgroundImage(`# background-image: bg\n${GRID}`, null);
  assertEquals(parse(t1).meta.backgroundImage, null);
  assertEquals(/background-image/.test(t1), false);

  const t2 = setBackgroundImage(`# background-image: bg\n${GRID}`, '');
  assertEquals(parse(t2).meta.backgroundImage, null);
});

// --- setPickupRequired ----------------------------------------------------

Deno.test('setPickupRequired: 0 inserts the line; round-trips to number', () => {
  const t = setPickupRequired(GRID, 0);
  assertMatch(t, /# pickup-required: 0/);
  assertEquals(parse(t).meta.pickupRequired, 0);
});

Deno.test('setPickupRequired: positive integer round-trips', () => {
  assertEquals(parse(setPickupRequired(GRID, 5)).meta.pickupRequired, 5);
});

Deno.test('setPickupRequired: "all" or null removes the line (default)', () => {
  const t1 = setPickupRequired(`# pickup-required: 3\n${GRID}`, 'all');
  assertEquals(parse(t1).meta.pickupRequired, 'all');
  assertEquals(/pickup-required/.test(t1), false);

  const t2 = setPickupRequired(`# pickup-required: 3\n${GRID}`, null);
  assertEquals(parse(t2).meta.pickupRequired, 'all');
});

Deno.test('setPickupRequired: negative / non-integer rejected (treated as "all" — remove)', () => {
  const t1 = setPickupRequired(`# pickup-required: 3\n${GRID}`, -1);
  assertEquals(parse(t1).meta.pickupRequired, 'all');
  const t2 = setPickupRequired(`# pickup-required: 3\n${GRID}`, 2.5);
  assertEquals(parse(t2).meta.pickupRequired, 'all');
});

Deno.test('directives play nicely with other headers (preserve order, no duplication)', () => {
  const t = new LevelText(`# name: tut\n# tileset: PlayWithYourPeas\n# size: 5x3\n${GRID}`)
    .setBackgroundImage('bg-blue-clouds')
    .setPickupRequired(2);
  const p = t.parse();
  assertEquals(p.meta.name, 'tut');
  assertEquals(p.meta.tileset, 'PlayWithYourPeas');
  assertEquals(p.meta.declared, { w: 5, h: 3 });
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(p.meta.pickupRequired, 2);
});

// --- setViewport ------------------------------------------------------------

Deno.test('setViewport: adds a new # viewport: line into the header band', () => {
  const out = setViewport(GRID, { w: 20, h: 10 });
  assertEquals(out.startsWith('# viewport: 20x10\n'), true);
  assertEquals(out.endsWith(GRID), true);
});

Deno.test('setViewport: replaces an existing # viewport: line', () => {
  const out = setViewport(`# viewport: 10x6\n${GRID}`, { w: 30, h: 18 });
  assertEquals(out.startsWith('# viewport: 30x18\n'), true);
  assertEquals(out.includes('# viewport: 10x6'), false);
});

Deno.test('setViewport: null removes the line', () => {
  const out = setViewport(`# viewport: 20x10\n${GRID}`, null);
  assertEquals(out.includes('# viewport:'), false);
  assertEquals(out, GRID);
});

Deno.test("setViewport: 'fit' is equivalent to null (removes the line)", () => {
  const out = setViewport(`# viewport: 20x10\n${GRID}`, 'fit');
  assertEquals(out.includes('# viewport:'), false);
});

Deno.test('setViewport: clamps before writing', () => {
  const out = setViewport(GRID, { w: 1000, h: 1 });
  // 1000 → 200 (VIEWPORT_MAX); 1 → 4 (VIEWPORT_MIN).
  assertEquals(out.startsWith('# viewport: 200x4\n'), true);
});

Deno.test('setViewport: garbage value (no w/h) removes the line', () => {
  const out = setViewport(`# viewport: 20x10\n${GRID}`, 'nonsense' as unknown as Dimensions);
  assertEquals(out.includes('# viewport:'), false);
});

// --- the class itself -------------------------------------------------------

Deno.test('LevelText is immutable: setters return a new instance', () => {
  const original = new LevelText(GRID);
  const changed = original.setViewport({ w: 20, h: 10 });
  assertEquals(original.text, GRID);
  assertEquals(changed === original, false);
  assertEquals(changed.text.startsWith('# viewport: 20x10\n'), true);
});

Deno.test('toString returns the text; parse gives the Level', () => {
  const t = new LevelText(`# name: a\n${GRID}`);
  assertEquals(`${t}`, `# name: a\n${GRID}`);
  assertEquals(t.parse().meta.name, 'a');
});

Deno.test('setTileset keeps its header rule: inserts before a hyphenated directive', () => {
  // The tileset setter's header test has never matched keys containing
  // '-', so it stops at the first one; the other setters skip past them.
  const t = setTileset(`# name: a\n# background-image: bg\n${GRID}`, 'Neon_Set');
  assertEquals(t, `# name: a\n# tileset: Neon_Set\n# background-image: bg\n${GRID}`);
  const v = setViewport(`# name: a\n# background-image: bg\n${GRID}`, { w: 8, h: 8 });
  assertEquals(v, `# name: a\n# background-image: bg\n# viewport: 8x8\n${GRID}`);
});
