import { assertEquals } from '@std/assert';
import { DrawSpec } from './DrawSpec.ts';
import { TilesetDirectory } from './TilesetDirectory.ts';
import type { ImageLoader, TilesetFetchResponse } from './TilesetIO.ts';

// A failed (404) response.
const notFound: TilesetFetchResponse = { ok: false, json: () => Promise.resolve(null) };

// Fake loader that records every URL and returns a 64x32 stub image.
function recordingLoader(): ImageLoader & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    load: (src) => {
      urls.push(src);
      return Promise.resolve({ width: 64, height: 32 } as unknown as HTMLImageElement);
    },
  };
}

Deno.test('TilesetDirectory: paths resolve under /data/tilesets/<id>/', async () => {
  const images = recordingLoader();
  const dir = new TilesetDirectory('PWYP', { fetch: () => Promise.resolve(notFound), images });
  assertEquals(dir.id, 'PWYP');
  assertEquals(dir.url, '/data/tilesets/PWYP/');
  await dir.image('tiles/Block.png');
  assertEquals(images.urls, ['/data/tilesets/PWYP/tiles/Block.png']);
});

Deno.test('TilesetDirectory.lookup: null on a failed response or a thrown fetch', async () => {
  const images = recordingLoader();
  const missing = new TilesetDirectory('x', { fetch: () => Promise.resolve(notFound), images });
  assertEquals(await missing.lookup(), null);
  const offline = new TilesetDirectory('x', {
    fetch: () => Promise.reject(new Error('offline')),
    images,
  });
  assertEquals(await offline.lookup(), null);
});

Deno.test('TilesetDirectory.sprite: applies the strip fields; null when the image fails', async () => {
  const dir = new TilesetDirectory('x', {
    fetch: () => Promise.resolve(notFound),
    images: recordingLoader(),
  });
  const sprite = await dir.sprite('p.png', 2, 1);
  assertEquals(sprite instanceof DrawSpec, true);
  assertEquals(sprite!.frameAt().sx, 32);
  const failing = new TilesetDirectory('x', { images: { load: () => Promise.resolve(null) } });
  assertEquals(await failing.sprite('missing.png'), null);
});
