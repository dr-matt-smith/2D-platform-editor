import { assert, assertEquals } from '@std/assert';
import { Legend } from '@2d-platform/level-format';
import { Tileset } from '@2d-platform/render';
import { TilesetCache } from './TilesetCache.ts';

// Loads tilesets with no files at all: no network, no DOM.
function countingLoader() {
  const calls: string[] = [];
  const load = (id: string) => {
    calls.push(id);
    return Tileset.load(id, {
      fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
      images: { load: () => Promise.resolve(null) },
    });
  };
  return { calls, load };
}

Deno.test('each tileset is loaded once, however often it is asked for', async () => {
  const { calls, load } = countingLoader();
  const cache = new TilesetCache(load);
  const first = cache.get('Dirt');
  assert(cache.get('Dirt') === first, 'the same load is shared');
  await cache.get('Other');
  assertEquals(calls, ['Dirt', 'Other']);
});

Deno.test('a tileset without a lookup gets the default legend', async () => {
  const { load } = countingLoader();
  const { tileset, legend } = await new TilesetCache(load).get('Missing');
  assertEquals(tileset.id, 'Missing');
  assertEquals(legend, Legend.DEFAULT);
});
