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

/**
 * Build a draw spec for a loaded image, honouring optional `frames`/
 * `frame` cropping (horizontal strip, one row). For `frames === 1`
 * (default) the spec covers the whole image and the drawImage args
 * match the v10 path exactly (Dirt byte-identical).
 *
 * A `frames` value that doesn't divide `image.width` is non-fatal —
 * console.warn'd, with the right edge ignored (TDD v11 §11 §recommendation).
 */
function buildSpec(image, framesField = 1, frameField = 0) {
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
  const frameIdx = Math.max(0, Math.floor(frameField ?? 0));
  const safeFrame = frameIdx < frames ? frameIdx : 0;
  return { image, sx: safeFrame * sw, sy: 0, sw, sh };
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
  // we can bucket decorations separately for the renderer's Pass 4a.
  const legend = buildLegend(lookup);
  const specsByChar = {};
  const decorationChars = new Set();
  for (const g of Object.values(lookup?.glyphs ?? {})) {
    if (!g?.char || !g?.image) continue;
    const im = await loadImageFn(base + g.image);
    const spec = buildSpec(im, g.frames, g.frame);
    if (spec) specsByChar[g.char] = spec;
    if (legend[g.char]?.role === 'decoration') decorationChars.add(g.char);
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
     */
    terrainFor(mask) {
      return (
        terrainMaskSpecs[mask] ??
        terrainDefaultSpec ??
        specsByChar['#'] ??
        null
      );
    },

    /**
     * Per-glyph entity DRAW SPEC keyed by char (P/E/^/o/…), or null.
     * Decorations are returned separately by `decorationFor`; this
     * accessor returns null for decoration chars so the renderer's
     * entity pass doesn't double-draw them.
     */
    entityFor(char) {
      if (decorationChars.has(char)) return null;
      return specsByChar[char] ?? null;
    },

    /**
     * v11: paintable, no-collision overlay glyphs. Returned by their
     * own accessor so the renderer can draw them in Pass 4a (under
     * entities). Returns null for non-decoration chars even if the
     * char is otherwise known.
     */
    decorationFor(char) {
      if (!decorationChars.has(char)) return null;
      return specsByChar[char] ?? null;
    },
  };
}
