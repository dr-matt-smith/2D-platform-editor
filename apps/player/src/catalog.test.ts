import { assertEquals, assertRejects } from '@std/assert';
import { groupLevels, loadCatalog, parseManifest, pickLevelId } from './catalog.ts';
import type { FetchLike, LevelEntry } from './catalog.ts';

const LEVELS: LevelEntry[] = [
  { id: 'a', name: 'A', file: 'a.txt', group: 'Easy' },
  { id: 'b', name: 'B', file: 'b.txt', group: 'Easy' },
  { id: 'c', name: 'C', file: 'c.txt', group: 'Hard' },
  { id: 'd', name: 'D', file: 'd.txt' },
];

// A fetch fake serving a fixed table of URL -> body.
function fakeFetch(files: Record<string, unknown>): FetchLike {
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

Deno.test('parseManifest keeps well-formed rows and defaults the name', () => {
  const rows = [
    { id: 'a', name: 'Alpha', file: 'a.txt' },
    { id: 'b', file: 'b.txt', group: 'World 1' },
    { id: 'c' }, // no file
    null,
    'nonsense',
  ];
  assertEquals(parseManifest(rows), [
    { id: 'a', name: 'Alpha', file: 'a.txt' },
    { id: 'b', name: 'b', file: 'b.txt', group: 'World 1' },
  ]);
});

Deno.test('parseManifest returns [] for a non-array', () => {
  assertEquals(parseManifest({ levels: [] }), []);
});

Deno.test('groupLevels groups consecutive levels in manifest order', () => {
  const groups = groupLevels(LEVELS);
  assertEquals(groups.map((g) => [g.group, g.levels.map((l) => l.id)]), [
    ['Easy', ['a', 'b']],
    ['Hard', ['c']],
    [null, ['d']],
  ]);
});

Deno.test('groupLevels puts an ungrouped manifest in a single group', () => {
  const plain = LEVELS.map(({ id, name, file }) => ({ id, name, file }));
  assertEquals(groupLevels(plain).length, 1);
  assertEquals(groupLevels(plain)[0].group, null);
});

Deno.test('pickLevelId honours a known id and falls back to the first', () => {
  assertEquals(pickLevelId(LEVELS, 'c'), 'c');
  assertEquals(pickLevelId(LEVELS, 'missing'), 'a');
  assertEquals(pickLevelId(LEVELS, null), 'a');
  assertEquals(pickLevelId([], 'a'), null);
});

Deno.test('loadCatalog fetches the manifest and level text under the base URL', async () => {
  const fetch = fakeFetch({
    '/game/data/levels/manifest.json': [{ id: 'a', name: 'A', file: 'a.txt' }],
    '/game/data/levels/a.txt': 'LEVEL A',
  });
  const catalog = await loadCatalog(fetch, '/game/');
  assertEquals(catalog.levels.map((l) => l.id), ['a']);
  assertEquals(catalog.find('a')?.name, 'A');
  assertEquals(catalog.find('zzz'), undefined);
  assertEquals(await catalog.loadText(catalog.levels[0]), 'LEVEL A');
});

Deno.test('loadCatalog rejects when the manifest or a level is missing', async () => {
  await assertRejects(() => loadCatalog(fakeFetch({}), '/'));
  const catalog = await loadCatalog(
    fakeFetch({ '/data/levels/manifest.json': [{ id: 'a', file: 'a.txt' }] }),
    '/',
  );
  await assertRejects(() => catalog.loadText(catalog.levels[0]));
});
