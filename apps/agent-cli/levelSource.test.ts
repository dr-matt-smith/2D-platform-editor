import { assert, assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import { buildLegend, DEFAULT_LEGEND, DEFAULT_TILESET } from '@2d-platform/level-format';
import { InputError, loadLegend, prepareLevel, readManifest, resolveLevel } from './levelSource.ts';

// Small fixture content folder: two levels and a glyph-remapping tileset.
// Paths are relative to this file so the tests run from any cwd.
const HERE = import.meta.dirname ?? '.';
const FIXTURES = `${HERE}/testdata`;
const BUNDLED = `${HERE}/../../content/data`;

Deno.test('readManifest lists the fixture levels', async () => {
  const ids = (await readManifest(FIXTURES)).map((e) => e.id);
  assertEquals(ids, ['corridor', 'walled_in']);
});

Deno.test('a level id resolves through the manifest', async () => {
  const level = await resolveLevel('corridor', FIXTURES);
  assertEquals(level.id, 'corridor');
  assertEquals(level.path, `${FIXTURES}/levels/corridor.txt`);
  assertStringIncludes(level.text, '#P...E#');
});

Deno.test('a bundled id resolves in the real content folder', async () => {
  const level = await resolveLevel('tutorial', BUNDLED);
  assertEquals(level.path, `${BUNDLED}/levels/tutorial.txt`);
});

Deno.test('a path is read directly and has no id', async () => {
  const path = `${FIXTURES}/levels/walled_in.txt`;
  const level = await resolveLevel(path, FIXTURES);
  assertEquals(level.id, null);
  assertEquals(level.path, path);
});

Deno.test('unknown ids and missing files are input errors', async () => {
  const unknown = await assertRejects(() => resolveLevel('nope', FIXTURES), InputError);
  assertStringIncludes(unknown.message, 'available: corridor, walled_in');
  const missing = await assertRejects(() => resolveLevel('missing.txt', FIXTURES), InputError);
  assertEquals(missing.message, 'level file not found: missing.txt');
  await assertRejects(() => readManifest('no/such/dir'), InputError, 'level manifest not found');
});

Deno.test('a tileset legend comes from its tile_lookup.json', async () => {
  const { legend, warning } = await loadLegend('Remapped', FIXTURES);
  assertEquals(warning, null);
  assertEquals(legend['@']?.role, 'player');
  assertEquals(legend['X']?.role, 'exit');
  assertEquals(legend['=']?.role, 'terrain');
  assertEquals(legend['P'], undefined);
});

Deno.test('the default tileset loads from disk like the editor', async () => {
  const lookupPath = `${BUNDLED}/tilesets/${DEFAULT_TILESET}/tile_lookup.json`;
  const lookup = JSON.parse(await Deno.readTextFile(lookupPath));
  const { legend, warning } = await loadLegend(DEFAULT_TILESET, BUNDLED);
  assertEquals(warning, null);
  assertEquals(legend, buildLegend(lookup));
});

Deno.test('an unknown tileset falls back to the default legend with a warning', async () => {
  const { legend, warning } = await loadLegend('Nonexistent', FIXTURES);
  assertEquals(legend, DEFAULT_LEGEND);
  assertEquals(warning, "unknown tileset 'Nonexistent', using default");
});

Deno.test('prepareLevel picks the legend of the declared tileset', async () => {
  const source = await resolveLevel(`${FIXTURES}/levels/remapped.txt`, FIXTURES);
  const level = await prepareLevel(source, FIXTURES);
  assertEquals(level.parsed.meta.tileset, 'Remapped');
  assert(level.legend['@']);
  assertEquals(level.tilesetWarning, null);
});
