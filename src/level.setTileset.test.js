import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, setTilesetDirective, DEFAULT_TILESET } from './level.js';

const grid = '########\n#P....E#\n########';

test('non-default tileset: inserts directive after existing headers', () => {
  const t = setTilesetDirective(`# name: a\n# size: 8x3\n${grid}`, 'Pixel Adventure 1');
  assert.equal(
    t,
    `# name: a\n# size: 8x3\n# tileset: Pixel Adventure 1\n${grid}`,
  );
  // re-parse: meta picks it up.
  assert.equal(parse(t).meta.tileset, 'Pixel Adventure 1');
});

test('non-default tileset on a header-less level: inserts at the very top', () => {
  const t = setTilesetDirective(grid, 'PlayWithYourPeas');
  assert.equal(t, `# tileset: PlayWithYourPeas\n${grid}`);
});

test('non-default tileset: rewrites an existing directive in place', () => {
  const t = setTilesetDirective(
    `# tileset: Pixel Adventure 1\n${grid}`,
    'Treasure Hunters',
  );
  assert.equal(t, `# tileset: Treasure Hunters\n${grid}`);
});

test('switching back to the default removes the directive', () => {
  const t = setTilesetDirective(
    `# name: a\n# tileset: Pixel Adventure 1\n${grid}`,
    DEFAULT_TILESET,
  );
  assert.equal(t, `# name: a\n${grid}`);
  assert.equal(parse(t).meta.tileset, DEFAULT_TILESET);
});

test('default on a level without a directive is a no-op', () => {
  const text = `# name: a\n${grid}`;
  assert.equal(setTilesetDirective(text, DEFAULT_TILESET), text);
});

test('respects // comments in the header region (inserts after them)', () => {
  const t = setTilesetDirective(
    `# name: a\n// hand-edit note\n${grid}`,
    'PlayWithYourPeas',
  );
  assert.equal(
    t,
    `# name: a\n// hand-edit note\n# tileset: PlayWithYourPeas\n${grid}`,
  );
});

test('tileset ids with spaces round-trip through parse()', () => {
  const t = setTilesetDirective(grid, 'Treasure Hunters');
  assert.equal(parse(t).meta.tileset, 'Treasure Hunters');
});
