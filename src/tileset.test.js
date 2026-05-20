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

// In v11 accessors return a draw spec `{image, sx, sy, sw, sh}` (or null).
// This helper digs out the source URL from the underlying mock Image.
const src = (spec) => spec?.image?._src ?? null;

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
  assert.equal(t.decorationFor?.('T'), null);
});

// --- v11 accessor contract (draw specs) -------------------------------

// Mock loadImage that bakes width/height into the returned stub so the
// loader's frame math has real numbers to work with.
const mockLoadImageWH = (w, h) => async (s) => ({ _src: s, width: w, height: h });

test('v11: accessors return draw specs {image, sx, sy, sw, sh}', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      terrain: { default: { image: 'tiles/Block.png' } },
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player', image: 'p.png' },
      },
    }),
    loadImage: mockLoadImageWH(32, 32),
  });
  const tspec = t.terrainFor('5');
  assert.deepEqual(
    { sx: tspec.sx, sy: tspec.sy, sw: tspec.sw, sh: tspec.sh },
    { sx: 0, sy: 0, sw: 32, sh: 32 },
  );
  assert.match(tspec.image._src, /\/x\/tiles\/Block\.png$/);

  const espec = t.entityFor('P');
  assert.deepEqual(
    { sx: espec.sx, sy: espec.sy, sw: espec.sw, sh: espec.sh },
    { sx: 0, sy: 0, sw: 32, sh: 32 },
  );
});

test('v11: glyphs.frames crops the spec to one frame of a horizontal strip', async () => {
  // Mask Dude-style: image is 352 wide × 32 tall, 11 frames horizontal.
  const t = await loadTileset('PA1', {
    fetch: mockFetch({
      glyphs: {
        player: {
          name: 'Mask Dude', char: 'P', role: 'player',
          image: 'Idle.png', frames: 11,
        },
      },
    }),
    loadImage: mockLoadImageWH(352, 32),
  });
  const spec = t.entityFor('P');
  assert.equal(spec.sx, 0);    // default frame = 0
  assert.equal(spec.sy, 0);
  assert.equal(spec.sw, 32);   // 352 / 11
  assert.equal(spec.sh, 32);
});

test('v11: glyphs.frame picks a specific frame index', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch({
      glyphs: {
        pickup: {
          name: 'Apple', char: 'o', role: 'pickup',
          image: 'Apple.png', frames: 17, frame: 5,
        },
      },
    }),
    loadImage: mockLoadImageWH(544, 32),
  });
  const spec = t.entityFor('o');
  assert.equal(spec.sw, 32);          // 544 / 17
  assert.equal(spec.sx, 5 * 32);      // frame 5
});

test('v11: out-of-range frame falls back to frame 0 (defensive)', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 4, frame: 99 },
      },
    }),
    loadImage: mockLoadImageWH(128, 32),
  });
  assert.equal(t.entityFor('P').sx, 0);
});

test('v11: non-divisor frame width still resolves (right edge ignored)', async () => {
  // Width 100 / 4 frames = 25 per frame (floor); 100 - 25*4 = 0 fits, so
  // pick a deliberately non-divisor: 101/4 = 25 floor, 4 used cols.
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 4 },
      },
    }),
    loadImage: mockLoadImageWH(101, 32),
  });
  // Loader warns; spec still produced with floor-divided frame width.
  assert.equal(t.entityFor('P').sw, 25);
});

test('v11: decorationFor returns decoration glyphs; entityFor returns null for them', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player', image: 'p.png' },
        tree:   { name: 'Tree', char: 'T', role: 'decoration', image: 't.png' },
        bush:   { name: 'Bush', char: 'b', role: 'decoration', image: 'b.png' },
      },
    }),
    loadImage: mockLoadImageWH(32, 32),
  });
  // Decorations live in their own bucket — never returned by entityFor.
  assert.equal(t.entityFor('T'), null);
  assert.equal(t.entityFor('b'), null);
  // … and entities aren't accidentally returned as decorations.
  assert.equal(t.decorationFor('P'), null);
  // The decoration accessor returns the right spec.
  assert.match(t.decorationFor('T').image._src, /\/x\/t\.png$/);
  assert.match(t.decorationFor('b').image._src, /\/x\/b\.png$/);
});
