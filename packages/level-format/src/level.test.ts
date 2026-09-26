import { assert, assertEquals, assertMatch } from '@std/assert';
import {
  parse,
  serialize,
  buildLegend,
  roleOf,
  V11_ROLES,
  LEGEND,
  DEFAULT_LEGEND,
  DEFAULT_TILESET,
} from './level.ts';

const SAMPLE = `# name: tutorial-01
# size: 20x6
####################
#..................#
#...P..............#
#........####.....E#
#........oooo......#
####################`;

Deno.test('parse reads header directives', () => {
  const { meta } = parse(SAMPLE);
  assertEquals(meta.name, 'tutorial-01');
  assertEquals(meta.declared, { w: 20, h: 6 });
  assertEquals(meta.width, 20);
  assertEquals(meta.height, 6);
});

Deno.test('theme directive: defaults to sky, parses cave, rejects unknown', () => {
  assertEquals(parse('###').meta.theme, 'sky');
  assertEquals(parse('# theme: cave\n###').meta.theme, 'cave');
  assertEquals(parse('# theme: lava\n###').meta.theme, 'sky');
});

Deno.test('grid rows are padded to the declared width', () => {
  const { grid } = parse('# size: 5x1\n##');
  assertEquals(grid, ['##...']);
});

Deno.test('// lines are stripped as comments', () => {
  const { grid, rows } = parse('// note\n# size: 3x1\n// mid\n###');
  assertEquals(grid, ['###']);
  assertEquals(rows[0].line, 4); // original file line preserved
});

Deno.test('a wall row is not mistaken for a directive', () => {
  const { meta, grid } = parse('####\n#..#');
  assertEquals(meta.name, null);
  assertEquals(grid, ['####', '#..#']);
});

Deno.test('parse -> serialize -> parse round-trips', () => {
  const a = parse(SAMPLE);
  const b = parse(serialize(a));
  assertEquals(b.meta, a.meta);
  assertEquals(b.grid, a.grid);
});

Deno.test('round-trip preserves a non-default theme', () => {
  const a = parse('# name: cave1\n# theme: cave\n# size: 3x1\n#P#');
  const text = serialize(a);
  assertMatch(text, /# theme: cave/);
  assertEquals(parse(text).meta.theme, 'cave');
});

Deno.test('tileset directive: defaults, parses, round-trips', () => {
  assertEquals(parse('###').meta.tileset, DEFAULT_TILESET);
  assertEquals(parse('# tileset: Neon_Set\n###').meta.tileset, 'Neon_Set');
  // default omitted on serialize, non-default emitted
  assert(!serialize(parse('###')).includes('# tileset:'));
  const a = parse('# name: n\n# tileset: Neon_Set\n# size: 3x1\n#P#');
  const text = serialize(a);
  assertMatch(text, /# tileset: Neon_Set/);
  assertEquals(parse(text).meta.tileset, 'Neon_Set');
});

Deno.test('LEGEND is the deprecated alias of DEFAULT_LEGEND', () => {
  assertEquals(LEGEND, DEFAULT_LEGEND);
  assertEquals(DEFAULT_LEGEND['#'].name, 'Filled'); // Wall → Filled
  assertEquals(DEFAULT_LEGEND['.'].name, 'Empty');
});

Deno.test('buildLegend maps a lookup glyphs section to a char-keyed legend', () => {
  const lookup = {
    glyphs: {
      empty: { name: 'Void', char: '.', role: 'background', color: '#000' },
      filled: { name: 'Rock', char: '#', role: 'terrain', image: 'tiles/x.png' },
      player: { name: 'Hero', char: '@', role: 'entity' },
    },
  };
  const lg = buildLegend(lookup);
  assertEquals(lg['.'], {
    name: 'Void', role: 'background', image: null, color: '#000',
  });
  assertEquals(lg['#'].image, 'tiles/x.png');
  assertEquals(lg['@'].name, 'Hero');
  assertEquals(buildLegend(null), DEFAULT_LEGEND); // no lookup → fallback
  assertEquals(buildLegend({}), DEFAULT_LEGEND);
});

// --- v11 role resolution ----------------------------------------------

Deno.test('V11_ROLES is the locked taxonomy (TDD v11 §3, extended by v18 §3.3)', () => {
  // v11 introduced 7 roles; v18 adds "foreground" for decoration glyphs
  // that render OVER entities (renderer Pass 4c).
  assertEquals(
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

Deno.test('DEFAULT_LEGEND now uses v11 specific roles, not the v10 generic ones', () => {
  assertEquals(DEFAULT_LEGEND['.'].role, 'background');
  assertEquals(DEFAULT_LEGEND['#'].role, 'terrain');
  assertEquals(DEFAULT_LEGEND.P.role, 'player');
  assertEquals(DEFAULT_LEGEND['^'].role, 'hazard'); // v10 had this mistyped as 'terrain'
  assertEquals(DEFAULT_LEGEND.o.role, 'pickup');
  assertEquals(DEFAULT_LEGEND.E.role, 'exit');
});

Deno.test('roleOf returns the v11 role for a char in the legend, null otherwise', () => {
  assertEquals(roleOf(DEFAULT_LEGEND, 'P'), 'player');
  assertEquals(roleOf(DEFAULT_LEGEND, 'E'), 'exit');
  assertEquals(roleOf(DEFAULT_LEGEND, '?'), null);
  assertEquals(roleOf(null, 'P'), null);
  assertEquals(roleOf(undefined, 'P'), null);
});

Deno.test('buildLegend: legacy v10 lookup (role:"entity") maps to v11 specifics via key', () => {
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
  assertEquals(lg.P.role, 'player');
  assertEquals(lg.E.role, 'exit');
  assertEquals(lg['^'].role, 'hazard'); // legacy 'terrain' overridden via key
  assertEquals(lg.o.role, 'pickup');
});

Deno.test('buildLegend: new-style key with explicit v11 role takes the role verbatim', () => {
  const lookup = {
    glyphs: {
      apple:  { name: 'Apple',  char: 'o', role: 'pickup' },
      cherry: { name: 'Cherry', char: 'O', role: 'pickup' },
      fire:   { name: 'Fire',   char: '*', role: 'hazard' },
      tree:   { name: 'Tree',   char: 'T', role: 'decoration' },
    },
  };
  const lg = buildLegend(lookup);
  assertEquals(lg.o.role, 'pickup');
  assertEquals(lg.O.role, 'pickup');
  assertEquals(lg['*'].role, 'hazard');
  assertEquals(lg.T.role, 'decoration');
});

Deno.test('buildLegend: unknown role on a new-style key resolves to "unknown"', () => {
  const lg = buildLegend({
    glyphs: { mystery: { name: '?', char: '?', role: 'meeple' } },
  });
  assertEquals(lg['?'].role, 'unknown');
});

Deno.test('buildLegend: legacy key wins over a deliberately-wrong explicit role', () => {
  // Safety net: a v10 lookup using a legacy key (`player`) but an author
  // who set role to 'hazard' by mistake — we keep the key meaning, not
  // the typo, so back-compat with the four shipped packs is robust.
  const lg = buildLegend({
    glyphs: { player: { name: 'P', char: 'P', role: 'hazard' } },
  });
  assertEquals(lg.P.role, 'player');
});
