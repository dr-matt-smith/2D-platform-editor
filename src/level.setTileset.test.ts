import { assertEquals } from '@std/assert';
import { parse, setTilesetDirective, DEFAULT_TILESET } from './level.ts';

const grid = '########\n#P....E#\n########';

Deno.test('non-default tileset: inserts directive after existing headers', () => {
  const t = setTilesetDirective(`# name: a\n# size: 8x3\n${grid}`, 'Pixel Adventure 1');
  assertEquals(
    t,
    `# name: a\n# size: 8x3\n# tileset: Pixel Adventure 1\n${grid}`,
  );
  // re-parse: meta picks it up.
  assertEquals(parse(t).meta.tileset, 'Pixel Adventure 1');
});

Deno.test('non-default tileset on a header-less level: inserts at the very top', () => {
  const t = setTilesetDirective(grid, 'PlayWithYourPeas');
  assertEquals(t, `# tileset: PlayWithYourPeas\n${grid}`);
});

Deno.test('non-default tileset: rewrites an existing directive in place', () => {
  const t = setTilesetDirective(
    `# tileset: Pixel Adventure 1\n${grid}`,
    'Treasure Hunters',
  );
  assertEquals(t, `# tileset: Treasure Hunters\n${grid}`);
});

Deno.test('switching back to the default removes the directive', () => {
  const t = setTilesetDirective(
    `# name: a\n# tileset: Pixel Adventure 1\n${grid}`,
    DEFAULT_TILESET,
  );
  assertEquals(t, `# name: a\n${grid}`);
  assertEquals(parse(t).meta.tileset, DEFAULT_TILESET);
});

Deno.test('default on a level without a directive is a no-op', () => {
  const text = `# name: a\n${grid}`;
  assertEquals(setTilesetDirective(text, DEFAULT_TILESET), text);
});

Deno.test('respects // comments in the header region (inserts after them)', () => {
  const t = setTilesetDirective(
    `# name: a\n// hand-edit note\n${grid}`,
    'PlayWithYourPeas',
  );
  assertEquals(
    t,
    `# name: a\n// hand-edit note\n# tileset: PlayWithYourPeas\n${grid}`,
  );
});

Deno.test('tileset ids with spaces round-trip through parse()', () => {
  const t = setTilesetDirective(grid, 'Treasure Hunters');
  assertEquals(parse(t).meta.tileset, 'Treasure Hunters');
});
