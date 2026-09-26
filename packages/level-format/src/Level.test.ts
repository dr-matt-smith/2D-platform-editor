import { assert, assertEquals, assertMatch } from '@std/assert';
import { Legend } from './Legend.ts';
import { Level } from './Level.ts';
import { Role } from './Role.ts';
import { Severity } from './Severity.ts';
import { Theme } from './Theme.ts';

const SAMPLE = `# name: tutorial-01
# size: 20x6
####################
#..................#
#...P..............#
#........####.....E#
#........oooo......#
####################`;

const GRID = '#####\n#P.E#\n#####';

// --- parse: grid and core directives ---------------------------------

Deno.test('parse reads header directives', () => {
  const { meta } = Level.parse(SAMPLE);
  assertEquals(meta.name, 'tutorial-01');
  assertEquals(meta.declared, { w: 20, h: 6 });
  assertEquals(meta.width, 20);
  assertEquals(meta.height, 6);
});

Deno.test('theme directive: defaults to sky, parses cave, rejects unknown', () => {
  assertEquals(Level.parse('###').meta.theme, Theme.Sky);
  assertEquals(Level.parse('# theme: cave\n###').meta.theme, Theme.Cave);
  assertEquals(Level.parse('# theme: lava\n###').meta.theme, Theme.Sky);
});

Deno.test('grid rows are padded to the declared width', () => {
  const { grid } = Level.parse('# size: 5x1\n##');
  assertEquals(grid, ['##...']);
});

Deno.test('// lines are stripped as comments', () => {
  const { grid, rows } = Level.parse('// note\n# size: 3x1\n// mid\n###');
  assertEquals(grid, ['###']);
  assertEquals(rows[0].line, 4); // original file line preserved
});

Deno.test('a wall row is not mistaken for a directive', () => {
  const { meta, grid } = Level.parse('####\n#..#');
  assertEquals(meta.name, null);
  assertEquals(grid, ['####', '#..#']);
});

Deno.test('parse -> serialize -> parse round-trips', () => {
  const a = Level.parse(SAMPLE);
  const b = Level.parse(a.serialize());
  assertEquals(b.meta, a.meta);
  assertEquals(b.grid, a.grid);
});

Deno.test('round-trip preserves a non-default theme', () => {
  const a = Level.parse('# name: cave1\n# theme: cave\n# size: 3x1\n#P#');
  const text = a.serialize();
  assertMatch(text, /# theme: cave/);
  assertEquals(Level.parse(text).meta.theme, Theme.Cave);
});

Deno.test('tileset directive: defaults, parses, round-trips', () => {
  assertEquals(Level.parse('###').meta.tileset, Level.DEFAULT_TILESET);
  assertEquals(Level.parse('# tileset: Neon_Set\n###').meta.tileset, 'Neon_Set');
  // default omitted on serialize, non-default emitted
  assert(!Level.parse('###').serialize().includes('# tileset:'));
  const a = Level.parse('# name: n\n# tileset: Neon_Set\n# size: 3x1\n#P#');
  const text = a.serialize();
  assertMatch(text, /# tileset: Neon_Set/);
  assertEquals(Level.parse(text).meta.tileset, 'Neon_Set');
});

// --- parse: background-image and pickup-required ----------------------

Deno.test('parse: meta.backgroundImage defaults to null, meta.pickupRequired to "all"', () => {
  const p = Level.parse(GRID);
  assertEquals(p.meta.backgroundImage, null);
  assertEquals(p.meta.pickupRequired, 'all');
});

Deno.test('parse: # background-image: <id> populates meta.backgroundImage', () => {
  const p = Level.parse(`# background-image: bg-blue-clouds\n${GRID}`);
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
});

Deno.test('parse: # pickup-required: 0 / N / all', () => {
  assertEquals(Level.parse(`# pickup-required: 0\n${GRID}`).meta.pickupRequired, 0);
  assertEquals(Level.parse(`# pickup-required: 3\n${GRID}`).meta.pickupRequired, 3);
  assertEquals(Level.parse(`# pickup-required: all\n${GRID}`).meta.pickupRequired, 'all');
});

Deno.test('parse: malformed # pickup-required falls back to default "all"', () => {
  assertEquals(Level.parse(`# pickup-required: nope\n${GRID}`).meta.pickupRequired, 'all');
  assertEquals(Level.parse(`# pickup-required: -1\n${GRID}`).meta.pickupRequired, 'all');
});

Deno.test('serialize round-trips background + pickup-required when set', () => {
  const text = `# name: t\n# background-image: bg-blue-clouds\n# pickup-required: 2\n${GRID}`;
  const out = Level.parse(text).serialize();
  // The header order in serialize may differ; what matters is that
  // re-parsing the serialized text yields the same meta.
  const round = Level.parse(out);
  assertEquals(round.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(round.meta.pickupRequired, 2);
  assertEquals(round.meta.name, 't');
});

Deno.test('serialize omits background-image and pickup-required when set to defaults', () => {
  const out = Level.parse(`# name: t\n${GRID}`).serialize();
  assertEquals(/background-image/.test(out), false);
  assertEquals(/pickup-required/.test(out), false);
});

// --- parse: viewport ---------------------------------------------------

Deno.test('parse: meta.viewport defaults to null (whole-world / fit mode)', () => {
  assertEquals(Level.parse(GRID).meta.viewport, null);
});

Deno.test('parse: # viewport: fit → null (explicit fit equals absent)', () => {
  assertEquals(Level.parse(`# viewport: fit\n${GRID}`).meta.viewport, null);
});

Deno.test('parse: # viewport: 20x10 → { w: 20, h: 10 }', () => {
  assertEquals(Level.parse(`# viewport: 20x10\n${GRID}`).meta.viewport, { w: 20, h: 10 });
});

Deno.test('parse: # viewport: 20X10 (uppercase X) also parses', () => {
  assertEquals(Level.parse(`# viewport: 20X10\n${GRID}`).meta.viewport, { w: 20, h: 10 });
});

Deno.test('parse: clamps below VIEWPORT_MIN (4) up', () => {
  assertEquals(Level.parse(`# viewport: 2x1\n${GRID}`).meta.viewport, {
    w: Level.VIEWPORT_MIN,
    h: Level.VIEWPORT_MIN,
  });
});

Deno.test('parse: clamps above VIEWPORT_MAX (200) down', () => {
  assertEquals(Level.parse(`# viewport: 500x500\n${GRID}`).meta.viewport, {
    w: Level.VIEWPORT_MAX,
    h: Level.VIEWPORT_MAX,
  });
});

Deno.test('parse: malformed `# viewport: hello` → stays null', () => {
  assertEquals(Level.parse(`# viewport: hello\n${GRID}`).meta.viewport, null);
});

Deno.test('parse: # viewport: plays nicely with # background-image: + # pickup-required:', () => {
  const src = `# background-image: bg-blue-clouds\n` +
    `# pickup-required: 3\n` +
    `# viewport: 24x14\n` +
    GRID;
  const p = Level.parse(src);
  assertEquals(p.meta.backgroundImage, 'bg-blue-clouds');
  assertEquals(p.meta.pickupRequired, 3);
  assertEquals(p.meta.viewport, { w: 24, h: 14 });
});

// --- serialize: viewport -------------------------------------------------

Deno.test('serialize: omits # viewport: when meta.viewport is null', () => {
  const out = Level.create(GRID.split('\n'), { viewport: null }).serialize();
  assertEquals(out.includes('# viewport:'), false);
});

Deno.test('serialize: emits # viewport: WxH when meta.viewport is set', () => {
  const out = Level.create(GRID.split('\n'), { viewport: { w: 20, h: 10 } }).serialize();
  assertEquals(out.includes('# viewport: 20x10'), true);
});

Deno.test('serialize → parse round-trip preserves the viewport', () => {
  const round = Level.parse(`# viewport: 24x14\n${GRID}`).serialize();
  assertEquals(Level.parse(round).meta.viewport, { w: 24, h: 14 });
});

Deno.test('serialize → parse round-trip absent stays absent', () => {
  const round = Level.parse(GRID).serialize();
  assertEquals(Level.parse(round).meta.viewport, null);
});

Deno.test('serialize: emits viewport after background-image + pickup-required', () => {
  const out = Level.create(GRID.split('\n'), {
    tileset: 'PlayWithYourPeas',
    backgroundImage: 'bg-blue-clouds',
    pickupRequired: 3,
    viewport: { w: 24, h: 14 },
  }).serialize();
  // The directive order is fixed by serialize(); verify by index so
  // future reorderings break the test loudly.
  const lines = out.split('\n');
  const bgIdx = lines.findIndex((l) => l.startsWith('# background-image:'));
  const prIdx = lines.findIndex((l) => l.startsWith('# pickup-required:'));
  const vpIdx = lines.findIndex((l) => l.startsWith('# viewport:'));
  assert(bgIdx >= 0 && prIdx >= 0 && vpIdx >= 0);
  assert(bgIdx < prIdx && prIdx < vpIdx, 'viewport should emit after the other directives');
});

// --- create, queries and delegation -------------------------------------

Deno.test('create: fills in defaults and derives width/height from the grid', () => {
  const level = Level.create(['#P', '#E#']);
  assertEquals(level.grid, ['#P.', '#E#']); // padded like parse
  assertEquals(level.width, 3);
  assertEquals(level.height, 2);
  assertEquals(level.tileset, Level.DEFAULT_TILESET);
  assertEquals(level.theme, Theme.Sky);
  assertEquals(level.name, null);
  assertEquals(level.rows[1], { text: '#E#', line: 2 });
});

Deno.test('toString is the serialized text', () => {
  const level = Level.parse(SAMPLE);
  assertEquals(level.toString(), level.serialize());
  assertEquals(`${level}`, SAMPLE);
});

Deno.test('cellAt reads a glyph by column and row; undefined off the grid', () => {
  const level = Level.parse(GRID);
  assertEquals(level.cellAt(1, 1), 'P');
  assertEquals(level.cellAt(3, 1), 'E');
  assertEquals(level.cellAt(9, 1), undefined);
  assertEquals(level.cellAt(0, -1), undefined);
});

Deno.test('findCells lists cells by role, in reading order', () => {
  const level = Level.parse('P.o\no.E');
  assertEquals(level.findCells(Role.Pickup), [{ col: 2, row: 0 }, { col: 0, row: 1 }]);
  assertEquals(level.findCells(Role.Player), [{ col: 0, row: 0 }]);
  // Role comes from the legend passed in.
  const legend = Legend.fromRecord({ P: { role: Role.Exit } });
  assertEquals(level.findCells(Role.Exit, legend), [{ col: 0, row: 0 }]);
});

Deno.test('pickupRequirement wraps meta.pickupRequired', () => {
  assertEquals(Level.parse(GRID).pickupRequirement.required, 'all');
  assertEquals(Level.parse(`# pickup-required: 2\n${GRID}`).pickupRequirement.required, 2);
});

Deno.test('validate delegates to LevelValidator with the given legend', () => {
  assertEquals(Level.parse(GRID).validate().filter((i) => i.severity === Severity.Error), []);
  const legend = Legend.fromRecord({ '#': { role: Role.Terrain }, '.': { role: Role.Background } });
  const messages = Level.parse(GRID).validate(legend).map((i) => i.message);
  assert(messages.includes("undefined glyph 'P'"));
});

Deno.test('clampViewport clamps to [VIEWPORT_MIN, VIEWPORT_MAX] and rounds', () => {
  assertEquals(Level.clampViewport(1), Level.VIEWPORT_MIN);
  assertEquals(Level.clampViewport(1000), Level.VIEWPORT_MAX);
  assertEquals(Level.clampViewport(12.4), 12);
  assertEquals(Level.clampViewport(NaN), Level.VIEWPORT_MIN);
});
