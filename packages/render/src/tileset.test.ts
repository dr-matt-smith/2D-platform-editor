import { assert, assertEquals, assertMatch, assertNotEquals } from '@std/assert';
import { loadTileset } from './tileset.ts';
import type { DrawSpec, LoadImage, TileLookup, TilesetFetch, TilesetFetchResponse } from './tileset.ts';

// The mock images are plain stubs carrying their source URL (and, for
// the frame-math tests, width/height); cast deliberately to the DOM type.
type StubImage = HTMLImageElement & { _src: string };

// --- fakes ---------------------------------------------------------------

// Mock `fetch` that returns the supplied object as the JSON body of the
// tileset's tile_lookup.json, and 404 otherwise.
const mockFetch = (lookup: TileLookup): TilesetFetch => async (url) => {
  if (url.endsWith('tile_lookup.json')) {
    return { ok: true, json: async () => lookup };
  }
  return { ok: false } as TilesetFetchResponse;
};

// Mock `loadImage` that returns a unique stub object per URL so tests can
// assert which path each accessor resolved through.
const mockLoadImage = (): LoadImage => async (src) => ({ _src: src }) as unknown as StubImage;

// Mock that fails specifically on the atlas image; used to assert
// `atlasReady: false` while other loads still succeed.
const mockLoadImageNoAtlas = (): LoadImage => async (src) =>
  src.endsWith('platformertiles.png') ? null : ({ _src: src } as unknown as StubImage);

// In v11 accessors return a draw spec `{image, sx, sy, sw, sh}` (or null).
// This helper digs out the source URL from the underlying mock Image.
const src = (spec: DrawSpec | null) => (spec?.image as StubImage | undefined)?._src ?? null;

// --- tests ---------------------------------------------------------------

Deno.test('terrainFor: legacy `filled` mask table still resolves (Dirt back-compat)', async () => {
  const t = await loadTileset('Dirt_Platformer_Tiles', {
    fetch: mockFetch({
      filled: { 0: { image: 'tiles/0.png' }, 15: { image: 'tiles/15.png' } },
      glyphs: { filled: { char: '#', image: 'tiles/01.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  assertMatch(src(t.terrainFor('0'))!,  /\/Dirt_Platformer_Tiles\/tiles\/0\.png$/);
  assertMatch(src(t.terrainFor('15'))!, /\/Dirt_Platformer_Tiles\/tiles\/15\.png$/);
});

Deno.test('terrainFor: new `terrain.masks` is read when present', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      terrain: { masks: { 5: { image: 'tiles/new.png' } } },
    }),
    loadImage: mockLoadImage(),
  });
  assertMatch(src(t.terrainFor('5'))!, /\/x\/tiles\/new\.png$/);
});

Deno.test('terrainFor: `terrain.masks` beats legacy `filled` if both present', async () => {
  const t = await loadTileset('hybrid', {
    fetch: mockFetch({
      filled: { 5: { image: 'old.png' } },
      terrain: { masks: { 5: { image: 'new.png' } } },
    }),
    loadImage: mockLoadImage(),
  });
  assertMatch(src(t.terrainFor('5'))!, /\/hybrid\/new\.png$/);
});

Deno.test('terrainFor: falls back to `terrain.default` when no mask match', async () => {
  const t = await loadTileset('PWYP', {
    fetch: mockFetch({
      terrain: { default: { image: 'tiles/Block.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  // Every mask resolves to the single default.
  for (const m of ['0', '7', '15']) {
    assertMatch(src(t.terrainFor(m))!, /\/PWYP\/tiles\/Block\.png$/);
  }
});

Deno.test('terrainFor: falls back to glyphs.filled.image (the legend thumb) last', async () => {
  // Mimics the four shipped non-Dirt tile_lookup.json files exactly —
  // only glyphs[*].image is authored; no terrain block.
  const t = await loadTileset('legend-only', {
    fetch: mockFetch({
      glyphs: { filled: { char: '#', image: 'tiles/LegendBlock.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  assertMatch(src(t.terrainFor('11'))!, /\/legend-only\/tiles\/LegendBlock\.png$/);
});

Deno.test('terrainFor: returns null when nothing terrain-related is declared', async () => {
  const t = await loadTileset('empty', {
    fetch: mockFetch({
      glyphs: { filled: { char: '#', image: null } },
    }),
    loadImage: mockLoadImage(),
  });
  assertEquals(t.terrainFor('5'), null);
});

Deno.test('entityFor: returns the per-char image from glyphs', async () => {
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
  assertMatch(src(t.entityFor('P'))!, /\/x\/p\.png$/);
  assertMatch(src(t.entityFor('E'))!, /\/x\/e\.png$/);
  assertEquals(t.entityFor('^'), null); // image:null → not loaded → null
  assertEquals(t.entityFor('Z'), null); // unknown char
});

// v22.1: imageLocked variant for the exit glyph.
Deno.test('entityFor: returns imageLocked for E when state.exitLocked is true', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        exit: { char: 'E', image: 'e_green.png', imageLocked: 'e_red.png' },
      },
    }),
    loadImage: mockLoadImage(),
  });
  // Default (no state) → primary image.
  assertMatch(src(t.entityFor('E'))!, /\/x\/e_green\.png$/);
  assertMatch(src(t.entityFor('E', undefined, null))!, /\/x\/e_green\.png$/);
  assertMatch(src(t.entityFor('E', undefined, {}))!, /\/x\/e_green\.png$/);
  assertMatch(src(t.entityFor('E', undefined, { exitLocked: false }))!, /\/x\/e_green\.png$/);
  // exitLocked true → locked variant.
  assertMatch(src(t.entityFor('E', undefined, { exitLocked: true }))!, /\/x\/e_red\.png$/);
});

Deno.test('entityFor: exitLocked flag without imageLocked authored falls back to primary', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: { exit: { char: 'E', image: 'e.png' } },
    }),
    loadImage: mockLoadImage(),
  });
  // No locked variant → back-compat: primary always.
  assertMatch(src(t.entityFor('E', undefined, { exitLocked: true }))!, /\/x\/e\.png$/);
});

Deno.test('entityFor: exitLocked flag does NOT affect non-E chars', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { char: 'P', image: 'p.png', imageLocked: 'p_locked.png' },
        exit:   { char: 'E', image: 'e.png', imageLocked: 'e_locked.png' },
      },
    }),
    loadImage: mockLoadImage(),
  });
  // The exitLocked flag is exit-specific by design — Player ignores it.
  assertMatch(src(t.entityFor('P', undefined, { exitLocked: true }))!, /\/x\/p\.png$/);
  assertMatch(src(t.entityFor('E', undefined, { exitLocked: true }))!, /\/x\/e_locked\.png$/);
});

Deno.test('atlasReady is false when the atlas PNG fails to load', async () => {
  const t = await loadTileset('no-atlas', {
    fetch: mockFetch({ glyphs: {} }),
    loadImage: mockLoadImageNoAtlas(),
  });
  assertEquals(t.atlasReady, false);
  assertEquals(t.ready, false); // legacy alias still surfaces the same value
});

Deno.test('atlasReady is true with a successful atlas load', async () => {
  const t = await loadTileset('Dirt_Platformer_Tiles', {
    fetch: mockFetch({ glyphs: {} }),
    loadImage: mockLoadImage(),
  });
  assertEquals(t.atlasReady, true);
});

Deno.test('missing tile_lookup.json (404) yields safe-null accessors, no throw', async () => {
  const t = await loadTileset('ghost', {
    fetch: async () => ({ ok: false }) as TilesetFetchResponse,
    loadImage: mockLoadImage(),
  });
  assertEquals(t.terrainFor('7'), null);
  assertEquals(t.entityFor('P'), null);
  assertEquals(t.decorationFor?.('T'), null);
});

// --- v11 accessor contract (draw specs) -------------------------------

// Mock loadImage that bakes width/height into the returned stub so the
// loader's frame math has real numbers to work with.
const mockLoadImageWH = (w: number, h: number): LoadImage => async (s) =>
  ({ _src: s, width: w, height: h }) as unknown as StubImage;

Deno.test('v11: accessors return draw specs {image, sx, sy, sw, sh}', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      terrain: { default: { image: 'tiles/Block.png' } },
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player', image: 'p.png' },
      },
    }),
    loadImage: mockLoadImageWH(32, 32),
  });
  const tspec = t.terrainFor('5')!;
  assertEquals(
    { sx: tspec.sx, sy: tspec.sy, sw: tspec.sw, sh: tspec.sh },
    { sx: 0, sy: 0, sw: 32, sh: 32 },
  );
  assertMatch((tspec.image as StubImage)._src, /\/x\/tiles\/Block\.png$/);

  const espec = t.entityFor('P')!;
  assertEquals(
    { sx: espec.sx, sy: espec.sy, sw: espec.sw, sh: espec.sh },
    { sx: 0, sy: 0, sw: 32, sh: 32 },
  );
});

Deno.test('v11: glyphs.frames crops the spec to one frame of a horizontal strip', async () => {
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
  const spec = t.entityFor('P')!;
  assertEquals(spec.sx, 0);    // default frame = 0
  assertEquals(spec.sy, 0);
  assertEquals(spec.sw, 32);   // 352 / 11
  assertEquals(spec.sh, 32);
});

Deno.test('v11: glyphs.frame picks a specific frame index', async () => {
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
  const spec = t.entityFor('o')!;
  assertEquals(spec.sw, 32);          // 544 / 17
  assertEquals(spec.sx, 5 * 32);      // frame 5
});

Deno.test('v11: out-of-range frame falls back to frame 0 (defensive)', async () => {
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 4, frame: 99 },
      },
    }),
    loadImage: mockLoadImageWH(128, 32),
  });
  assertEquals(t.entityFor('P')!.sx, 0);
});

Deno.test('v11: non-divisor frame width still resolves (right edge ignored)', async () => {
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
  assertEquals(t.entityFor('P')!.sw, 25);
});

Deno.test('v11: decorationFor returns decoration glyphs; entityFor returns null for them', async () => {
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
  assertEquals(t.entityFor('T'), null);
  assertEquals(t.entityFor('b'), null);
  // … and entities aren't accidentally returned as decorations.
  assertEquals(t.decorationFor('P'), null);
  // The decoration accessor returns the right spec.
  assertMatch((t.decorationFor('T')!.image as StubImage)._src, /\/x\/t\.png$/);
  assertMatch((t.decorationFor('b')!.image as StubImage)._src, /\/x\/b\.png$/);
});

// --- v16 animated playback (TDD §4 truth table) -----------------------

// 11-frame strip at the default fps (10).
const animatedPlayerLookup: TileLookup = {
  glyphs: {
    player: { name: 'Mask Dude', char: 'P', role: 'player',
      image: 'Idle.png', frames: 11 /* fps default 10 */ },
  },
};

Deno.test('v16: frames>1 + no frame, no fps → animator cycles at default 10 fps', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch(animatedPlayerLookup),
    loadImage: mockLoadImageWH(352, 32), // 11 frames of 32px each
  });
  // At now=0, frame 0 (sx=0).
  assertEquals(t.entityFor('P', 0)!.sx, 0);
  // At default 10 fps, 100ms is exactly one frame.
  assertEquals(t.entityFor('P', 100)!.sx, 32);
  assertEquals(t.entityFor('P', 200)!.sx, 64);
  // Cycle: 11 frames × 100ms = 1100ms is one full cycle → frame 0.
  assertEquals(t.entityFor('P', 1100)!.sx, 0);
  // Mid-cycle: frame 5.
  assertEquals(t.entityFor('P', 550)!.sx, 5 * 32);
});

Deno.test('v16: back-compat — entityFor without `now` resolves to frame 0', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch(animatedPlayerLookup),
    loadImage: mockLoadImageWH(352, 32),
  });
  // Existing v11/v15 callers pass no `now`. Animator default-clamps
  // to time 0 → frame 0. (This is what keeps every pre-v16 test green.)
  assertEquals(t.entityFor('P')!.sx, 0);
});

Deno.test('v16: explicit `frame: i` freezes regardless of `now` (v11 author override)', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 11, frame: 5 },
      },
    }),
    loadImage: mockLoadImageWH(352, 32),
  });
  // Different `now` values all return the same static spec.
  assertEquals(t.entityFor('P', 0)!.sx,   5 * 32);
  assertEquals(t.entityFor('P', 500)!.sx, 5 * 32);
  assertEquals(t.entityFor('P', 9999)!.sx, 5 * 32);
});

Deno.test('v16: `fps: 0` is the explicit freeze opt-out (frame 0 always)', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 11, fps: 0 },
      },
    }),
    loadImage: mockLoadImageWH(352, 32),
  });
  assertEquals(t.entityFor('P', 0)!.sx, 0);
  assertEquals(t.entityFor('P', 500)!.sx, 0);
});

Deno.test('v16: custom `fps` controls the cycle rate', async () => {
  // 4 frames of 32px, fps:25 → one frame every 40ms.
  const t = await loadTileset('x', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'P', char: 'P', role: 'player',
          image: 'p.png', frames: 4, fps: 25 },
      },
    }),
    loadImage: mockLoadImageWH(128, 32),
  });
  assertEquals(t.entityFor('P', 0)!.sx,   0);
  assertEquals(t.entityFor('P', 40)!.sx,  32);    // frame 1
  assertEquals(t.entityFor('P', 80)!.sx,  64);    // frame 2
  assertEquals(t.entityFor('P', 160)!.sx, 0);     // wrap: frame 4 % 4
});

Deno.test('v16: negative or non-finite `now` clamp safely to frame 0', async () => {
  const t = await loadTileset('PA1', {
    fetch: mockFetch(animatedPlayerLookup),
    loadImage: mockLoadImageWH(352, 32),
  });
  assertEquals(t.entityFor('P', -1)!.sx, 0);
  assertEquals(t.entityFor('P', NaN)!.sx, 0);
});

Deno.test('v16: animator runs at draw-time, not load-time — same tileset, different snapshots', async () => {
  // Critical for the renderer: the spec must reflect `now` at the
  // CALL site, not the load site. (i.e. don't accidentally close
  // over a frozen frame.)
  const t = await loadTileset('PA1', {
    fetch: mockFetch(animatedPlayerLookup),
    loadImage: mockLoadImageWH(352, 32),
  });
  const a = t.entityFor('P', 0)!;
  const b = t.entityFor('P', 300)!;
  assertNotEquals(a.sx, b.sx);
});

// --- v18 background images + foreground decoration ------------------

Deno.test('v18: lookup.images role:background → backgroundImage(id) returns the loaded Image', async () => {
  const t = await loadTileset('PWYP', {
    fetch: mockFetch({
      glyphs: { filled: { char: '#', image: 'tiles/Block.png' } },
      images: {
        'bg-blue-clouds': { name: 'Blue', role: 'background', image: 'tiles/Background.png' },
        'deco-plate':     { name: 'Plate', role: 'decoration', image: 'tiles/Plate.png' },
      },
    }),
    loadImage: mockLoadImageWH(640, 400),
  });
  const bg = t.backgroundImage('bg-blue-clouds');
  assert(bg, 'background image returned');
  assertMatch((bg as StubImage)._src, /\/PWYP\/tiles\/Background\.png$/);
  // Unknown ID → null (renderer's safe fallback path).
  assertEquals(t.backgroundImage('does-not-exist'), null);
  // Decoration images are NOT exposed via backgroundImage.
  assertEquals(t.backgroundImage('deco-plate'), null);
});

Deno.test('v18: lookup.images role:decoration → decorationImage(id) returns the Image (v19 placement reuses)', async () => {
  const t = await loadTileset('PWYP', {
    fetch: mockFetch({
      images: {
        'deco-plate':   { name: 'Plate',   role: 'decoration', image: 'tiles/Plate.png' },
        'deco-cloud-1': { name: 'Cloud 1', role: 'decoration', image: 'tiles/Cloud1.png' },
      },
    }),
    loadImage: mockLoadImageWH(64, 64),
  });
  assert(t.decorationImage('deco-plate'));
  assert(t.decorationImage('deco-cloud-1'));
  assertEquals(t.decorationImage('bg-blue-clouds'), null); // wrong role
});

Deno.test('v18: role:"foreground" glyph → foregroundFor returns spec; entityFor/decorationFor return null', async () => {
  // Mirror PWYPs Flag Pole entry (key not in ROLE_FROM_KEY, explicit role
  // "foreground" wins via the v11 resolver — v18 extended V11_ROLES).
  const t = await loadTileset('PWYP', {
    fetch: mockFetch({
      glyphs: {
        player: { name: 'Pea', char: 'P', role: 'player', image: 'P.png' },
        flagpole: { name: 'Flag Pole', char: '|', role: 'foreground', image: 'pole.png' },
      },
    }),
    loadImage: mockLoadImageWH(32, 32),
  });
  // foregroundFor returns a spec for the foreground char only.
  assert(t.foregroundFor('|'));
  assertEquals(t.foregroundFor('|')!.sw, 32);
  // entityFor returns null for the foreground char (the renderer's
  // Pass 4b doesnt draw it; Pass 4c does).
  assertEquals(t.entityFor('|'), null);
  // decorationFor (the Pass 4a "background-decoration" bucket) is
  // also null — foreground gets its own bucket.
  assertEquals(t.decorationFor('|'), null);
  // Regular entities still work.
  assert(t.entityFor('P'));
});

Deno.test('v18: no images / no foreground in lookup → accessors return null gracefully', async () => {
  const t = await loadTileset('Dirt', {
    fetch: mockFetch({ glyphs: {} }),
    loadImage: mockLoadImage(),
  });
  assertEquals(t.backgroundImage('anything'), null);
  assertEquals(t.decorationImage('anything'), null);
  assertEquals(t.foregroundFor('|'), null);
});
