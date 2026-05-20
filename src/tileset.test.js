import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTileset } from './tileset.js';

// --- fakes ---------------------------------------------------------------

// Mock `fetch` that returns the supplied object as the JSON body of the
// tileset's tile_lookup.json, and 404 otherwise.
const mockFetch = (lookup) => async (url) => {
  if (url.endsWith('tile_lookup.json')) {
    return { ok: true, json: async () => lookup };
  }
  return { ok: false };
};

// Mock `loadImage` that returns a unique stub object per URL so tests can
// assert which path each accessor resolved through.
const mockLoadImage = () => async (src) => ({ _src: src });

// Mock that fails specifically on the atlas image; used to assert
// `atlasReady: false` while other loads still succeed.
const mockLoadImageNoAtlas = () => async (src) =>
  src.endsWith('platformertiles.png') ? null : { _src: src };

const src = (im) => im?._src ?? null;

// --- tests ---------------------------------------------------------------

test('terrainFor: legacy `filled` mask table still resolves (Dirt back-compat)', async () => {
  const t = await loadTileset('Dirt_Platformer_Tiles', {
    fetch: mockFetch({
      filled: { 0: { image: 'tiles/0.png' }, 15: { image: 'tiles/15.png' } },
      glyphs: { filled: { char: '#', image: 'tiles/01.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  assert.match(src(t.terrainFor('0')),  /\/Dirt_Platformer_Tiles\/tiles\/0\.png$/);
  assert.match(src(t.terrainFor('15')), /\/Dirt_Platformer_Tiles\/tiles\/15\.png$/);
});

test('terrainFor: new `terrain.masks` is read when present', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      terrain: { masks: { 5: { image: 'tiles/new.png' } } },
    }),
    loadImage: mockLoadImage(),
  });
  assert.match(src(t.terrainFor('5')), /\/x\/tiles\/new\.png$/);
});

test('terrainFor: `terrain.masks` beats legacy `filled` if both present', async () => {
  const t = await loadTileset('hybrid', {
    fetch: mockFetch({
      filled: { 5: { image: 'old.png' } },
      terrain: { masks: { 5: { image: 'new.png' } } },
    }),
    loadImage: mockLoadImage(),
  });
  assert.match(src(t.terrainFor('5')), /\/hybrid\/new\.png$/);
});

test('terrainFor: falls back to `terrain.default` when no mask match', async () => {
  const t = await loadTileset('PWYP', {
    fetch: mockFetch({
      terrain: { default: { image: 'tiles/Block.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  // Every mask resolves to the single default.
  for (const m of ['0', '7', '15']) {
    assert.match(src(t.terrainFor(m)), /\/PWYP\/tiles\/Block\.png$/);
  }
});

test('terrainFor: falls back to glyphs.filled.image (the legend thumb) last', async () => {
  // Mimics the four shipped non-Dirt tile_lookup.json files exactly —
  // only glyphs[*].image is authored; no terrain block.
  const t = await loadTileset('legend-only', {
    fetch: mockFetch({
      glyphs: { filled: { char: '#', image: 'tiles/LegendBlock.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  assert.match(src(t.terrainFor('11')), /\/legend-only\/tiles\/LegendBlock\.png$/);
});

test('terrainFor: returns null when nothing terrain-related is declared', async () => {
  const t = await loadTileset('empty', {
    fetch: mockFetch({
      glyphs: { filled: { char: '#', image: null } },
    }),
    loadImage: mockLoadImage(),
  });
  assert.equal(t.terrainFor('5'), null);
});

test('entityFor: returns the per-char image from glyphs', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { char: 'P', image: 'p.png' },
        exit:   { char: 'E', image: 'e.png' },
        hazard: { char: '^', image: null },
      },
    }),
    loadImage: mockLoadImage(),
  });
  assert.match(src(t.entityFor('P')), /\/x\/p\.png$/);
  assert.match(src(t.entityFor('E')), /\/x\/e\.png$/);
  assert.equal(t.entityFor('^'), null); // image:null → not loaded → null
  assert.equal(t.entityFor('Z'), null); // unknown char
});

test('atlasReady is false when the atlas PNG fails to load', async () => {
  const t = await loadTileset('no-atlas', {
    fetch: mockFetch({ glyphs: {} }),
    loadImage: mockLoadImageNoAtlas(),
  });
  assert.equal(t.atlasReady, false);
  assert.equal(t.ready, false); // legacy alias still surfaces the same value
});

test('atlasReady is true with a successful atlas load', async () => {
  const t = await loadTileset('Dirt_Platformer_Tiles', {
    fetch: mockFetch({ glyphs: {} }),
    loadImage: mockLoadImage(),
  });
  assert.equal(t.atlasReady, true);
});

test('missing tile_lookup.json (404) yields safe-null accessors, no throw', async () => {
  const t = await loadTileset('ghost', {
    fetch: async () => ({ ok: false }),
    loadImage: mockLoadImage(),
  });
  assert.equal(t.terrainFor('7'), null);
  assert.equal(t.entityFor('P'), null);
});
