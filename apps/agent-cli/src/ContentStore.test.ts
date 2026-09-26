import { assert, assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import { Legend, Level, Role } from '@2d-platform/level-format';
import { ContentStore } from './ContentStore.ts';
import { InputError } from './InputError.ts';
import type { FileReader } from './FileReader.ts';

// Small fixture content folder: two levels and a glyph-remapping tileset.
// Paths are relative to this file so the tests run from any cwd.
const HERE = import.meta.dirname ?? '.';
const FIXTURES = `${HERE}/../testdata`;
const BUNDLED = `${HERE}/../../../content/data`;

const fixtures = new ContentStore(FIXTURES);
const bundled = new ContentStore(BUNDLED);

// A FileReader serving a fixed table of path -> text, and recording reads.
class FakeFiles implements FileReader {
  readonly reads: string[] = [];
  constructor(private readonly files: Record<string, string>) {}

  readTextFile(path: string): Promise<string> {
    this.reads.push(path);
    const text = this.files[path];
    return text === undefined ? Promise.reject(new Deno.errors.NotFound(path)) : Promise.resolve(text);
  }
}

Deno.test('readManifest lists the fixture levels', async () => {
  const ids = (await fixtures.readManifest()).map((e) => e.id);
  assertEquals(ids, ['corridor', 'walled_in']);
});

Deno.test('a level id resolves through the manifest', async () => {
  const level = await fixtures.resolve('corridor');
  assertEquals(level.id, 'corridor');
  assertEquals(level.path, `${FIXTURES}/levels/corridor.txt`);
  assertStringIncludes(level.text, '#P...E#');
});

Deno.test('a bundled id resolves in the real content folder', async () => {
  const level = await bundled.resolve('tutorial');
  assertEquals(level.path, `${BUNDLED}/levels/tutorial.txt`);
});

Deno.test('a path is read directly and has no id', async () => {
  const path = `${FIXTURES}/levels/walled_in.txt`;
  const level = await fixtures.resolve(path);
  assertEquals(level.id, null);
  assertEquals(level.path, path);
});

Deno.test('unknown ids and missing files are input errors', async () => {
  const unknown = await assertRejects(() => fixtures.resolve('nope'), InputError);
  assertStringIncludes(unknown.message, 'available: corridor, walled_in');
  const missing = await assertRejects(() => fixtures.resolve('missing.txt'), InputError);
  assertEquals(missing.message, 'level file not found: missing.txt');
  await assertRejects(() => new ContentStore('no/such/dir').readManifest(), InputError, 'level manifest not found');
});

Deno.test('a manifest that is not a list of entries is an input error', async () => {
  const store = new ContentStore('c', new FakeFiles({ 'c/levels/manifest.json': '[{ "id": "a" }]' }));
  await assertRejects(() => store.readManifest(), InputError, 'is not a list of { id, name, file } entries');
});

Deno.test('loadBundled reads the entry\'s file through the injected reader', async () => {
  const files = new FakeFiles({ 'c/levels/a.txt': 'LEVEL A' });
  const level = await new ContentStore('c', files).loadBundled({ id: 'a', name: 'A', file: 'a.txt' });
  assertEquals(level, { id: 'a', path: 'c/levels/a.txt', text: 'LEVEL A' });
  assertEquals(files.reads, ['c/levels/a.txt']);
});

Deno.test('a tileset legend comes from its tile_lookup.json', async () => {
  const { legend, warning } = await fixtures.loadLegend('Remapped');
  assertEquals(warning, null);
  assertEquals(legend.roleOf('@'), Role.Player);
  assertEquals(legend.roleOf('X'), Role.Exit);
  assertEquals(legend.roleOf('='), Role.Terrain);
  assertEquals(legend.get('P'), undefined);
});

Deno.test('the default tileset loads from disk like the editor', async () => {
  const lookupPath = `${BUNDLED}/tilesets/${Level.DEFAULT_TILESET}/tile_lookup.json`;
  const lookup = JSON.parse(await Deno.readTextFile(lookupPath));
  const { legend, warning } = await bundled.loadLegend(Level.DEFAULT_TILESET);
  assertEquals(warning, null);
  assertEquals(legend, Legend.fromLookup(lookup));
});

Deno.test('an unknown tileset falls back to the default legend with a warning', async () => {
  const { legend, warning } = await fixtures.loadLegend('Nonexistent');
  assertEquals(legend, Legend.DEFAULT);
  assertEquals(warning, "unknown tileset 'Nonexistent', using default");
});

Deno.test('prepare picks the legend of the declared tileset', async () => {
  const source = await fixtures.resolve(`${FIXTURES}/levels/remapped.txt`);
  const level = await fixtures.prepare(source);
  assertEquals(level.parsed.meta.tileset, 'Remapped');
  assert(level.legend.has('@'));
  assertEquals(level.tilesetWarning, null);
});
