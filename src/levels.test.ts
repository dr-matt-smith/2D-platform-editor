import { assertEquals } from '@std/assert';
import { createLevels } from './levels.ts';
import type { FetchLike } from './levels.ts';

// localStorage-shaped fake: getItem returns null when absent.
function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    has: (k: string) => m.has(k),
  };
}

const MANIFEST = [
  { id: 'above_ground', name: 'above_ground', file: 'above_ground.txt' },
  { id: 'below_ground', name: 'below_ground', file: 'below_ground.txt' },
];
const ORIGINALS: Record<string, string> = {
  '/data/levels/above_ground.txt': 'ABOVE',
  '/data/levels/below_ground.txt': 'BELOW',
};

const TILESETS = [
  { id: 'Dirt_Platformer_Tiles', name: 'Dirt Platformer Tiles' },
  { id: 'Neon_Set', name: 'Neon Set' },
];

// Partial Response fakes (cast to FetchLike at the call sites): the code
// only reads json/text after checking `ok`.
function fakeFetch() {
  return async (url: string) => {
    if (url === '/data/levels/manifest.json')
      return { ok: true, json: async () => MANIFEST };
    if (url === '/data/tilesets/manifest.json')
      return { ok: true, json: async () => TILESETS };
    if (url in ORIGINALS)
      return { ok: true, text: async () => ORIGINALS[url] };
    return { ok: false };
  };
}

async function setup(seed?: Record<string, string>) {
  const storage = fakeStorage(seed);
  const levels = createLevels({ fetch: fakeFetch() as unknown as FetchLike, storage });
  await levels.init();
  return { levels, storage };
}

Deno.test('load returns the original and clears dirty', async () => {
  const { levels } = await setup();
  const text = await levels.load('above_ground');
  assertEquals(text, 'ABOVE');
  assertEquals(levels.isDirty('ABOVE'), false);
  assertEquals(levels.isDirty('ABOVE!'), true);
});

Deno.test('a saved draft takes precedence over the original', async () => {
  const { levels, storage } = await setup();
  await levels.load('above_ground');
  levels.save('above_ground', 'EDITED');
  assertEquals(storage.getItem('ld:v3:draft:above_ground'), 'EDITED');
  assertEquals(await levels.load('above_ground'), 'EDITED');
  assertEquals(levels.isDirty('EDITED'), false); // save reset the baseline
});

Deno.test('revert deletes the draft and reloads the original', async () => {
  const { levels, storage } = await setup();
  levels.save('below_ground', 'JUNK');
  assertEquals(await levels.revert('below_ground'), 'BELOW');
  assertEquals(storage.has('ld:v3:draft:below_ground'), false);
});

Deno.test('revert on a local level keeps its text (there is no original)', async () => {
  const { levels, storage } = await setup();
  const id = levels.addLocal('PASTED', 'mine');
  assertEquals(await levels.revert(id), 'PASTED');
  assertEquals(storage.getItem(`ld:v3:draft:${id}`), 'PASTED');
  assertEquals(levels.isDirty('PASTED'), false); // baseline reset to the stored text
});

Deno.test('list flags levels that have a draft', async () => {
  const { levels } = await setup();
  levels.save('below_ground', 'X');
  const byId = Object.fromEntries(levels.list().map((l) => [l.id, l.modified]));
  assertEquals(byId, { above_ground: false, below_ground: true });
});

Deno.test('legacy v1 key migrates once into the first level draft', async () => {
  const { levels, storage } = await setup({ 'leveldesigner:v1': 'OLD' });
  assertEquals(storage.getItem('ld:v3:draft:above_ground'), 'OLD');
  assertEquals(storage.getItem('ld:v3:lastOpen'), 'above_ground');
  assertEquals(storage.has('leveldesigner:v1'), false);

  // Re-adding the legacy key and re-init must NOT migrate again.
  storage.setItem('leveldesigner:v1', 'AGAIN');
  const again = createLevels({ fetch: fakeFetch() as unknown as FetchLike, storage });
  await again.init();
  assertEquals(storage.getItem('ld:v3:draft:above_ground'), 'OLD');
  assertEquals(storage.has('leveldesigner:v1'), true); // left untouched
});

Deno.test('peek returns text without moving the dirty baseline', async () => {
  const { levels } = await setup();
  await levels.load('above_ground'); // baseline = 'ABOVE'
  assertEquals(await levels.peek('below_ground'), 'BELOW');
  assertEquals(levels.isDirty('ABOVE'), false); // baseline untouched by peek
});

Deno.test('peek on a local level returns its text, or empty when it has none', async () => {
  const { levels } = await setup();
  const id = levels.addLocal('PASTED');
  assertEquals(await levels.peek(id), 'PASTED');
  assertEquals(await levels.peek('local-missing'), '');
});

Deno.test('tilesets() returns the manifest and memoises (one fetch)', async () => {
  let calls = 0;
  const fetch = async (url: string) => {
    if (url === '/data/tilesets/manifest.json') {
      calls++;
      return { ok: true, json: async () => TILESETS };
    }
    if (url === '/data/levels/manifest.json')
      return { ok: true, json: async () => MANIFEST };
    return { ok: false };
  };
  const levels = createLevels({ fetch: fetch as unknown as FetchLike, storage: fakeStorage() });
  await levels.init();
  assertEquals(await levels.tilesets(), TILESETS);
  await levels.tilesets(); // second call must not refetch
  assertEquals(calls, 1);
});

Deno.test('tilesets() degrades to [] when the manifest is missing', async () => {
  const fetch = async (url: string) =>
    url === '/data/levels/manifest.json'
      ? { ok: true, json: async () => MANIFEST }
      : { ok: false };
  const levels = createLevels({ fetch: fetch as unknown as FetchLike, storage: fakeStorage() });
  await levels.init();
  assertEquals(await levels.tilesets(), []);
});

Deno.test('lastOpen round-trips', async () => {
  const { levels } = await setup();
  assertEquals(levels.lastOpen(), null);
  levels.setLastOpen('below_ground');
  assertEquals(levels.lastOpen(), 'below_ground');
});
