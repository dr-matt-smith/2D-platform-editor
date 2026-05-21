import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  serialize,
  buildLegend,
  roleOf,
  V11_ROLES,
  LEGEND,
  DEFAULT_LEGEND,
  DEFAULT_TILESET,
} from './level.js';

const SAMPLE = `# name: tutorial-01
# size: 20x6
####################
#..................#
#...P..............#
#........####.....E#
#........oooo......#
####################`;

test('parse reads header directives', () => {
  const { meta } = parse(SAMPLE);
  assert.equal(meta.name, 'tutorial-01');
  assert.deepEqual(meta.declared, { w: 20, h: 6 });
  assert.equal(meta.width, 20);
  assert.equal(meta.height, 6);
});

test('theme directive: defaults to sky, parses cave, rejects unknown', () => {
  assert.equal(parse('###').meta.theme, 'sky');
  assert.equal(parse('# theme: cave\n###').meta.theme, 'cave');
  assert.equal(parse('# theme: lava\n###').meta.theme, 'sky');
});

test('grid rows are padded to the declared width', () => {
  const { grid } = parse('# size: 5x1\n##');
  assert.deepEqual(grid, ['##...']);
});

test('// lines are stripped as comments', () => {
  const { grid, rows } = parse('// note\n# size: 3x1\n// mid\n###');
  assert.deepEqual(grid, ['###']);
  assert.equal(rows[0].line, 4); // original file line preserved
});

test('a wall row is not mistaken for a directive', () => {
  const { meta, grid } = parse('####\n#..#');
  assert.equal(meta.name, null);
  assert.deepEqual(grid, ['####', '#..#']);
});

test('parse -> serialize -> parse round-trips', () => {
  const a = parse(SAMPLE);
  const b = parse(serialize(a));
  assert.deepEqual(b.meta, a.meta);
  assert.deepEqual(b.grid, a.grid);
});

test('round-trip preserves a non-default theme', () => {
  const a = parse('# name: cave1\n# theme: cave\n# size: 3x1\n#P#');
  const text = serialize(a);
  assert.match(text, /# theme: cave/);
  assert.equal(parse(text).meta.theme, 'cave');
});

test('tileset directive: defaults, parses, round-trips', () => {
  assert.equal(parse('###').meta.tileset, DEFAULT_TILESET);
  assert.equal(parse('# tileset: Neon_Set\n###').meta.tileset, 'Neon_Set');
  // default omitted on serialize, non-default emitted
  assert.ok(!serialize(parse('###')).includes('# tileset:'));
  const a = parse('# name: n\n# tileset: Neon_Set\n# size: 3x1\n#P#');
  const text = serialize(a);
  assert.match(text, /# tileset: Neon_Set/);
  assert.equal(parse(text).meta.tileset, 'Neon_Set');
});

test('LEGEND is the deprecated alias of DEFAULT_LEGEND', () => {
  assert.equal(LEGEND, DEFAULT_LEGEND);
  assert.equal(DEFAULT_LEGEND['#'].name, 'Filled'); // Wall → Filled
  assert.equal(DEFAULT_LEGEND['.'].name, 'Empty');
});

test('buildLegend maps a lookup glyphs section to a char-keyed legend', () => {
  const lookup = {
    glyphs: {
      empty: { name: 'Void', char: '.', role: 'background', color: '#000' },
      filled: { name: 'Rock', char: '#', role: 'terrain', image: 'tiles/x.png' },
      player: { name: 'Hero', char: '@', role: 'entity' },
    },
  };
  const lg = buildLegend(lookup);
  assert.deepEqual(lg['.'], {
    name: 'Void', role: 'background', image: null, color: '#000',
  });
  assert.equal(lg['#'].image, 'tiles/x.png');
  assert.equal(lg['@'].name, 'Hero');
  assert.equal(buildLegend(null), DEFAULT_LEGEND); // no lookup → fallback
  assert.equal(buildLegend({}), DEFAULT_LEGEND);
});

// --- v11 role resolution ----------------------------------------------

test('V11_ROLES is the locked taxonomy (TDD v11 §3, extended by v18 §3.3)', () => {
  // v11 introduced 7 roles; v18 adds "foreground" for decoration glyphs
  // that render OVER entities (renderer Pass 4c).
  assert.deepEqual(
    [...V11_ROLES].sort(),
    [
      'background',
      'decoration',
      'exit',
      'foreground',
      'hazard',
      'pickup',
      'player',
      'terrain',
    ],
  );
});

test('DEFAULT_LEGEND now uses v11 specific roles, not the v10 generic ones', () => {
  assert.equal(DEFAULT_LEGEND['.'].role, 'background');
  assert.equal(DEFAULT_LEGEND['#'].role, 'terrain');
  assert.equal(DEFAULT_LEGEND.P.role, 'player');
  assert.equal(DEFAULT_LEGEND['^'].role, 'hazard'); // v10 had this mistyped as 'terrain'
  assert.equal(DEFAULT_LEGEND.o.role, 'pickup');
  assert.equal(DEFAULT_LEGEND.E.role, 'exit');
});

test('roleOf returns the v11 role for a char in the legend, null otherwise', () => {
  assert.equal(roleOf(DEFAULT_LEGEND, 'P'), 'player');
  assert.equal(roleOf(DEFAULT_LEGEND, 'E'), 'exit');
  assert.equal(roleOf(DEFAULT_LEGEND, '?'), null);
  assert.equal(roleOf(null, 'P'), null);
  assert.equal(roleOf(undefined, 'P'), null);
});

test('buildLegend: legacy v10 lookup (role:"entity") maps to v11 specifics via key', () => {
  // Mirrors the shape every shipped tile_lookup.json uses (Dirt + the
  // four user packs): the role string is coarse but the KEY is specific.
  const lookup = {
    glyphs: {
      empty:  { name: 'Empty',  char: '.', role: 'background' },
      filled: { name: 'Filled', char: '#', role: 'terrain' },
      player: { name: 'P',      char: 'P', role: 'entity' },
      exit:   { name: 'E',      char: 'E', role: 'entity' },
      hazard: { name: 'H',      char: '^', role: 'terrain' }, // v10 mistype
      pickup: { name: 'p',      char: 'o', role: 'entity' },
    },
  };
  const lg = buildLegend(lookup);
  assert.equal(lg.P.role, 'player');
  assert.equal(lg.E.role, 'exit');
  assert.equal(lg['^'].role, 'hazard'); // legacy 'terrain' overridden via key
  assert.equal(lg.o.role, 'pickup');
});

test('buildLegend: new-style key with explicit v11 role takes the role verbatim', () => {
  const lookup = {
    glyphs: {
      apple:  { name: 'Apple',  char: 'o', role: 'pickup' },
      cherry: { name: 'Cherry', char: 'O', role: 'pickup' },
      fire:   { name: 'Fire',   char: '*', role: 'hazard' },
      tree:   { name: 'Tree',   char: 'T', role: 'decoration' },
    },
  };
  const lg = buildLegend(lookup);
  assert.equal(lg.o.role, 'pickup');
  assert.equal(lg.O.role, 'pickup');
  assert.equal(lg['*'].role, 'hazard');
  assert.equal(lg.T.role, 'decoration');
});

test('buildLegend: unknown role on a new-style key resolves to "unknown"', () => {
  const lg = buildLegend({
    glyphs: { mystery: { name: '?', char: '?', role: 'meeple' } },
  });
  assert.equal(lg['?'].role, 'unknown');
});

test('buildLegend: legacy key wins over a deliberately-wrong explicit role', () => {
  // Safety net: a v10 lookup using a legacy key (`player`) but an author
  // who set role to 'hazard' by mistake — we keep the key meaning, not
  // the typo, so back-compat with the four shipped packs is robust.
  const lg = buildLegend({
    glyphs: { player: { name: 'P', char: 'P', role: 'hazard' } },
  });
  assert.equal(lg.P.role, 'player');
});
