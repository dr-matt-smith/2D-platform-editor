// Tileset loader. Resolves tiles from a per-tileset tile_lookup.json:
//
//   - `terrain.masks[m].image` (0..15) — autotile mask table.
//   - `terrain.default.image`         — single-tile fallback for tilesets
//                                       that don't ship edge variants.
//   - `lookup.filled` (LEGACY, kept)  — read as `terrain.masks` when the
//                                       new field is absent, so Dirt's
//                                       existing JSON is byte-untouched.
//   - `glyphs[role].image`            — per-glyph entity sprite, also
//                                       reused as the *terrain* last-step
//                                       fallback (the legend thumbnail
//                                       for `#`), so a tileset declaring
//                                       only its legend can still render
//                                       a distinct block on the canvas.
//
// The atlas image (Dirt's `platformertiles.png`) drives the decor pass
// (sky / moon / stars / grass / drips / cave fill) via `drawTile(index)`
// — that data is Dirt-only by design (v8 known limit, preserved in v10).
//
// `loadTileset(id, opts?)` always resolves. Missing/failed image or
// lookup degrade gracefully — the renderer's per-cell fallback chain
// (renderer.js v10 §5) handles `null` results from the accessors below.
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
 * Load a tileset's atlas + lookup and return draw accessors. Always
 * resolves; failures degrade to `null` returns from the accessors so the
 * renderer can fall back without exceptions.
 *
 * @param {string} id          tileset directory under `/data/tilesets/`
 * @param {object} [opts]
 * @param {Function} [opts.fetch]      injectable for tests
 * @param {Function} [opts.loadImage]  injectable for tests (default uses Image)
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
    /* offline / missing lookup → terrainFor/entityFor return null */
  }

  // --- terrain mask table (new shape wins; legacy `filled` is the alias)
  const masksDecl =
    lookup?.terrain?.masks ?? lookup?.filled ?? null;
  const terrainMasks = {};
  if (masksDecl) {
    await Promise.all(
      Object.entries(masksDecl).map(async ([mask, def]) => {
        if (def?.image) terrainMasks[mask] = await loadImageFn(base + def.image);
      }),
    );
  }
  const terrainDefault = lookup?.terrain?.default?.image
    ? await loadImageFn(base + lookup.terrain.default.image)
    : null;

  // --- entity images keyed by char (legend → also used by the renderer
  // in v10 onward). Glyphs with `image: null` are skipped (Dirt's
  // pattern), so `entityFor` returns null for them and the renderer
  // falls back to shapes.
  const entityImages = {};
  for (const g of Object.values(lookup?.glyphs ?? {})) {
    if (g?.char && g?.image) {
      const im = await loadImageFn(base + g.image);
      if (im) entityImages[g.char] = im;
    }
  }

  const atlasCrop = (ctx, index, dx, dy, size) => {
    const sx = (index % ATLAS.cols) * ATLAS.tile;
    const sy = Math.floor(index / ATLAS.cols) * ATLAS.tile;
    ctx.drawImage(image, sx, sy, ATLAS.tile, ATLAS.tile, dx, dy, size, size);
  };

  return {
    image,
    lookup,
    // Gates the renderer's decor pass (atlas-only; v10 design §5). Old
    // `ready` callers see the same value via the alias below.
    atlasReady: !!image,
    ready: !!image, // legacy alias (kept for any in-flight consumers)

    // Decor / background (atlas-backed, indices < 24).
    drawTile: atlasCrop,

    /**
     * Resolve the terrain image for a 4-neighbour mask (0..15) through
     * the v10 fallback chain (design §4): masks → default → glyphs.
     * `filled.image` → null. Returning `null` is the renderer's signal
     * to draw a colour-shape fallback for that cell.
     */
    terrainFor(mask) {
      return (
        terrainMasks[mask] ??
        terrainDefault ??
        entityImages['#'] ??
        null
      );
    },

    /** Per-glyph entity image keyed by char (P/E/^/o/…), or null. */
    entityFor(char) {
      return entityImages[char] ?? null;
    },

    // Legacy compatibility shim — preserved so the renderer can call
    // it during the M2 hand-off (the renderer is updated to terrainFor
    // there). Routes through the same fallback chain as terrainFor.
    drawFilled(ctx, mask, dx, dy, size) {
      const im = terrainMasks[mask] ?? terrainDefault ?? entityImages['#'];
      if (im) ctx.drawImage(im, 0, 0, im.width, im.height, dx, dy, size, size);
      else if (image) atlasCrop(ctx, 9, dx, dy, size); // missing → dirt centre
    },
  };
}
