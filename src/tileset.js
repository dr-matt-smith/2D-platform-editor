// Tileset loader. Resolves tiles from a per-tileset tile_lookup.json:
//
//   - `terrain.masks[m].image` (0..15) — autotile mask table.
//   - `terrain.default.image`          — single-tile fallback for tilesets
//                                        that don't ship edge variants.
//   - `lookup.filled` (LEGACY)         — read as `terrain.masks` when the
//                                        new field is absent, so Dirt's
//                                        existing JSON is byte-untouched.
//   - `glyphs[role].image`             — per-glyph entity sprite. The
//                                        glyph for '#' doubles as the
//                                        terrain last-step fallback.
//   - `glyphs[role].frames`/.frame`    — optional v11 sprite-sheet
//                                        cropping (horizontal strip).
//
// In v11 every accessor returns a **draw spec** `{ image, sx, sy, sw, sh }`
// (or null), so the renderer can blit a sub-region of a sheet without
// the loader caring. Without `frames` (or `frames: 1`), the spec covers
// the whole image — identical drawImage args to the v10 path → Dirt
// renders byte-identically.
//
// The atlas image (Dirt's `platformertiles.png`) drives the decor pass
// (sky / moon / stars / grass / drips / cave fill) via `drawTile(index)`
// — that data is Dirt-only by design (v8 known limit, preserved).
//
// `loadTileset(id, opts?)` always resolves. Missing/failed image or
// lookup degrade gracefully — accessors return null and the renderer
// (or playtest gate) handles it.
import { buildLegend } from './level.js';

const DEFAULT_TILESET = 'Dirt_Platformer_Tiles';
// Vite's deploy base ('/' in dev / root deploys, '/2D-platform-editor/'
// on GitHub Pages). See src/levels.js for the rationale.
const BASE = import.meta.env?.BASE_URL ?? '/';
const baseFor = (id) => `${BASE}data/tilesets/${id}/`;

// Atlas geometry is shared across tilesets (decor/bg still Dirt-atlas-bound
// — see v10 design §5/§11); only the directory is per-id.
export const ATLAS = {
  src: baseFor(DEFAULT_TILESET) + 'platformertiles.png',
  tile: 32,
  cols: 8,
  rows: 3,
};

// Default Image-element loader. Injectable via `opts.loadImage` for tests
// (node has no `Image`); production passes nothing and gets this.
const browserLoadImage = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

// Default playback rate for an animated glyph (TDD v16 §4): authors who
// declare `frames > 1` without an explicit `frame` get this fps unless
// they override with `fps: <n>` (or `fps: 0` to freeze on frame 0).
const DEFAULT_FPS = 10;

/**
 * Build a draw spec for a loaded image, honouring optional `frames` /
 * `frame` / `fps` (TDD v16 §4). Returns one of:
 *
 *   • a STATIC spec `{ image, sx, sy, sw, sh }` — for `frames === 1`
 *     (whole image), an explicit `frame: i` (still at frame i, v11
 *     author override), or `fps: 0` (explicit freeze on frame 0); or
 *   • an ANIMATOR `(now) => spec` — for `frames > 1` with no explicit
 *     `frame`, cycling at `fps` (default 10). The animator is a pure
 *     function of `now` (no shared mutable state), so unit tests can
 *     hit it with any clock value.
 *
 * Accessors below normalise both shapes via `resolve(entry, now)`.
 * Calling an animator with `now === undefined` resolves to frame 0
 * (`(undefined ?? 0) * fps / 1000 === 0`), so v11/v15 callers that
 * don't pass `now` continue to see the static-frame-0 behaviour.
 *
 * A `frames` value that doesn't divide `image.width` is non-fatal —
 * console.warn'd, with the right edge ignored (TDD v11 §11).
 */
function buildSpec(image, framesField = 1, frameField = null, fpsField = null) {
  if (!image) return null;
  const frames = Math.max(1, Math.floor(framesField ?? 1));
  if (frames === 1) {
    return { image, sx: 0, sy: 0, sw: image.width, sh: image.height };
  }
  const sw = Math.floor(image.width / frames);
  const sh = image.height;
  if (frames * sw !== image.width) {
    // eslint-disable-next-line no-console
    console.warn(
      `tileset: frames:${frames} doesn't divide image width ${image.width}; right edge ignored`,
    );
  }
  // Author override: explicit `frame: i` → static at clamped frame.
  if (frameField != null) {
    const frameIdx = Math.max(0, Math.floor(frameField));
    const safeFrame = frameIdx < frames ? frameIdx : 0;
    return { image, sx: safeFrame * sw, sy: 0, sw, sh };
  }
  // No explicit frame: animate at `fps`. fps === 0 is the explicit
  // "freeze on frame 0" opt-out for animated sheets.
  const fps = Math.max(0, Math.floor(fpsField ?? DEFAULT_FPS));
  if (fps === 0) {
    return { image, sx: 0, sy: 0, sw, sh };
  }
  return (now) => {
    // Defensive clamp: `??` doesn't catch NaN, and a negative `now`
    // would produce a negative `sx` (drawImage UB). Real callers
    // pass `performance.now()` so this is belt-and-braces, but the
    // unit tests exercise NaN / negative explicitly.
    const t = Number.isFinite(now) && now > 0 ? now : 0;
    const frame = Math.floor((t * fps) / 1000) % frames;
    return { image, sx: frame * sw, sy: 0, sw, sh };
  };
}

// Normalise a stored entry into a draw spec at time `now`. Static
// entries are returned as-is; animator functions are called with
// `now` (and produce frame 0 when `now` is undefined).
function resolve(entry, now) {
  if (entry == null) return null;
  return typeof entry === 'function' ? entry(now) : entry;
}

/**
 * @param {string} id   tileset directory under `/data/tilesets/`
 * @param {object} [opts]
 * @param {Function} [opts.fetch]      injectable for tests
 * @param {Function} [opts.loadImage]  injectable for tests
 */
export async function loadTileset(id = DEFAULT_TILESET, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const loadImageFn = opts.loadImage ?? browserLoadImage;
  const base = baseFor(id);

  const image = await loadImageFn(base + 'platformertiles.png');

  let lookup = null;
  try {
    const res = await fetchFn(base + 'tile_lookup.json');
    if (res.ok) lookup = await res.json();
  } catch {
    /* offline / missing lookup → accessors return null */
  }

  // Terrain masks (new shape wins; legacy `filled` is the alias). These
  // are always full-image specs in v11 — no `frames` on terrain entries.
  const masksDecl = lookup?.terrain?.masks ?? lookup?.filled ?? null;
  const terrainMaskSpecs = {};
  if (masksDecl) {
    await Promise.all(
      Object.entries(masksDecl).map(async ([mask, def]) => {
        if (def?.image) {
          const im = await loadImageFn(base + def.image);
          if (im) terrainMaskSpecs[mask] = buildSpec(im, 1, 0);
        }
      }),
    );
  }
  const terrainDefaultImg = lookup?.terrain?.default?.image
    ? await loadImageFn(base + lookup.terrain.default.image)
    : null;
  const terrainDefaultSpec = buildSpec(terrainDefaultImg, 1, 0);

  // All glyph images keyed by char, with frame cropping applied per
  // glyph entry. The resolved legend tells us each char's v11 role so
  // we can bucket decorations separately for the renderer's Pass 4a
  // (background-decorations, drawn UNDER entities) and the v18 Pass
  // 4c (foreground-decorations, drawn OVER entities).
  const legend = buildLegend(lookup);
  const specsByChar = {};
  const decorationChars = new Set();
  const foregroundChars = new Set(); // v18
  for (const g of Object.values(lookup?.glyphs ?? {})) {
    if (!g?.char || !g?.image) continue;
    const im = await loadImageFn(base + g.image);
    // v16: also read optional `fps`; buildSpec returns either a static
    // spec (frames=1; or frame:i explicit; or fps:0) or a (now)=>spec
    // animator (frames>1 with no explicit frame).
    const spec = buildSpec(im, g.frames, g.frame, g.fps);
    if (spec) specsByChar[g.char] = spec;
    const role = legend[g.char]?.role;
    if (role === 'decoration') decorationChars.add(g.char);
    else if (role === 'foreground') foregroundChars.add(g.char);
  }

  // v18: `images` block — stable IDs keyed; each entry declares a
  // `role` (`background` = whole-rectangle stretch fill;
  // `decoration` = free-positioned overlay, placement deferred to
  // v19 but we pre-load the image so v19 is purely additive).
  const backgroundImages = {};
  const decorationImages = {};
  if (lookup?.images) {
    await Promise.all(
      Object.entries(lookup.images).map(async ([imgId, def]) => {
        if (!def?.image) return;
        const im = await loadImageFn(base + def.image);
        if (!im) return;
        if (def.role === 'background') backgroundImages[imgId] = im;
        else if (def.role === 'decoration') decorationImages[imgId] = im;
      }),
    );
  }

  const atlasCrop = (ctx, index, dx, dy, size) => {
    const sx = (index % ATLAS.cols) * ATLAS.tile;
    const sy = Math.floor(index / ATLAS.cols) * ATLAS.tile;
    ctx.drawImage(image, sx, sy, ATLAS.tile, ATLAS.tile, dx, dy, size, size);
  };

  return {
    image,
    lookup,
    // Gates the decor pass (atlas-only; v10/v11 design §5).
    atlasReady: !!image,
    ready: !!image, // legacy alias

    // Decor / background (atlas-backed, indices < 24).
    drawTile: atlasCrop,

    /**
     * Resolve a terrain DRAW SPEC for a 4-neighbour mask (0..15)
     * through the v10 fallback chain: masks → default →
     * `glyphs.filled.image` (the legend thumb) → null. Returning null
     * is the renderer's signal to draw a colour-shape fallback.
     *
     * v16: optional `now` (ms, e.g. `performance.now()`) drives any
     * animated `glyphs.filled` strip; omitting it resolves to
     * frame 0 (back-compat — terrain rarely animates and editor
     * preview never calls with `now`).
     */
    terrainFor(mask, now) {
      const entry =
        terrainMaskSpecs[mask] ??
        terrainDefaultSpec ??
        specsByChar['#'] ??
        null;
      return resolve(entry, now);
    },

    /**
     * Per-glyph entity DRAW SPEC keyed by char (P/E/^/o/…), or null.
     * Decorations are returned separately by `decorationFor`; this
     * accessor returns null for decoration chars so the renderer's
     * entity pass doesn't double-draw them.
     *
     * v16: optional `now` (ms) drives multi-frame animation. Omitting
     * it resolves to frame 0 — the editor preview takes this path and
     * stays static, matching v11/v15.
     */
    entityFor(char, now) {
      // v18: foreground decorations also bypass entityFor — they get
      // drawn by Pass 4c via foregroundFor(), AFTER entities + player.
      if (decorationChars.has(char) || foregroundChars.has(char)) return null;
      return resolve(specsByChar[char], now);
    },

    /**
     * v11: paintable, no-collision overlay glyphs. Returned by their
     * own accessor so the renderer can draw them in Pass 4a (under
     * entities). Returns null for non-decoration chars even if the
     * char is otherwise known. v16: `now` carries through to animated
     * decorations.
     */
    decorationFor(char, now) {
      if (!decorationChars.has(char)) return null;
      return resolve(specsByChar[char], now);
    },

    /**
     * v18: foreground-decoration glyphs (role: "foreground"). Drawn
     * by renderer Pass 4c, AFTER entities + player, so a Flag Pole
     * etc. correctly sits in front of the player. Inert in playtest
     * — `entityFor` returns null for these chars, the adapter
     * doesn't build a collision entity for them. Returns null for
     * any non-foreground char.
     */
    foregroundFor(char, now) {
      if (!foregroundChars.has(char)) return null;
      return resolve(specsByChar[char], now);
    },

    /**
     * v18: pre-loaded `images.<id>` entries declared with
     * `role: "background"`. Painted stretched-to-fill by the
     * renderer's Pass 0a when `parsed.meta.backgroundImage`
     * matches an ID here. Returns null for unknown IDs.
     */
    backgroundImage(id) {
      return backgroundImages[id] ?? null;
    },

    /**
     * v18: pre-loaded `images.<id>` entries declared with
     * `role: "decoration"`. Schema-declared in v18 but free
     * placement is v19+ — accessor exists so v19's renderer can
     * use the cached images without re-fetching.
     */
    decorationImage(id) {
      return decorationImages[id] ?? null;
    },
  };
}
