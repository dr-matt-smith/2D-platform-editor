import { assertEquals, assertRejects } from '@std/assert';
import { LevelCatalog } from './LevelCatalog.ts';
import type { LevelEntry } from './LevelEntry.ts';
import type { LevelFetch } from './LevelFetch.ts';

const LEVELS: LevelEntry[] = [
  { id: 'a', name: 'A', file: 'a.txt', group: 'Easy' },
  { id: 'b', name: 'B', file: 'b.txt', group: 'Easy' },
  { id: 'c', name: 'C', file: 'c.txt', group: 'Hard' },
  { id: 'd', name: 'D', file: 'd.txt' },
];

// A fetch fake serving a fixed table of URL -> body.
function fakeFetch(files: Record<string, unknown>): LevelFetch {
  return (url) => {
    const found = url in files;
    const body = files[url];
    return Promise.resolve({
      ok: found,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(String(body)),
    });
  };
}

// A catalog over a fixed list; its fetch is never called.
const catalogOf = (levels: LevelEntry[]) => new LevelCatalog(levels, fakeFetch({}), '/');

Deno.test('parseManifest keeps well-formed rows and defaults the name', () => {
  const rows = [
    { id: 'a', name: 'Alpha', file: 'a.txt' },
    { id: 'b', file: 'b.txt', group: 'World 1' },
    { id: 'c' }, // no file
    null,
    'nonsense',
  ];
  assertEquals(LevelCatalog.parseManifest(rows), [
    { id: 'a', name: 'Alpha', file: 'a.txt' },
    { id: 'b', name: 'b', file: 'b.txt', group: 'World 1' },
  ]);
});

Deno.test('parseManifest returns [] for a non-array', () => {
  assertEquals(LevelCatalog.parseManifest({ levels: [] }), []);
});

Deno.test('groups() groups consecutive levels in manifest order', () => {
  const groups = catalogOf(LEVELS).groups();
  assertEquals(groups.map((g) => [g.group, g.levels.map((l) => l.id)]), [
    ['Easy', ['a', 'b']],
    ['Hard', ['c']],
    [null, ['d']],
  ]);
});

Deno.test('groups() puts an ungrouped manifest in a single group', () => {
  const plain = catalogOf(LEVELS.map(({ id, name, file }) => ({ id, name, file })));
  assertEquals(plain.groups().length, 1);
  assertEquals(plain.groups()[0].group, null);
});

Deno.test('pick() honours a known id and falls back to the first', () => {
  const catalog = catalogOf(LEVELS);
  assertEquals(catalog.pick('c'), 'c');
  assertEquals(catalog.pick('missing'), 'a');
  assertEquals(catalog.pick(null), 'a');
  assertEquals(catalogOf([]).pick('a'), null);
});

Deno.test('LevelCatalog.load fetches the manifest and level text under the base URL', async () => {
  const fetch = fakeFetch({
    '/game/data/levels/manifest.json': [{ id: 'a', name: 'A', file: 'a.txt' }],
    '/game/data/levels/a.txt': 'LEVEL A',
  });
  const catalog = await LevelCatalog.load(fetch, '/game/');
  assertEquals(catalog.levels.map((l) => l.id), ['a']);
  assertEquals(catalog.find('a')?.name, 'A');
  assertEquals(catalog.find('zzz'), undefined);
  assertEquals(await catalog.loadText(catalog.levels[0]), 'LEVEL A');
});

Deno.test('LevelCatalog.load rejects when the manifest or a level is missing', async () => {
  await assertRejects(() => LevelCatalog.load(fakeFetch({}), '/'), Error, 'Could not load the level list.');
  const catalog = await LevelCatalog.load(
    fakeFetch({ '/data/levels/manifest.json': [{ id: 'a', file: 'a.txt' }] }),
    '/',
  );
  await assertRejects(() => catalog.loadText(catalog.levels[0]), Error, 'Could not load level "a".');
});

Deno.test('loadText calls the injected fetch unbound, as the browser requires', async () => {
  let receiver: unknown = 'not called';
  const fetch: LevelFetch = function (this: unknown) {
    receiver = this;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null), text: () => Promise.resolve('') });
  };
  await new LevelCatalog(LEVELS, fetch, '/').loadText(LEVELS[0]);
  assertEquals(receiver, undefined);
});
