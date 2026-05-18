// Tileset loader (v7). Filled-terrain tiles are resolved from the tileset's
// tile_lookup.json keyed by the 4-neighbour mask 0–15 (design §4/§5). The
// atlas image is still used for the decor/background pass (sky, moon, stars,
// grass, drips, cave fill) via drawTile(index).
const TILESET_DIR = '/data/tilesets/Dirt_Platformer_Tiles/';
const LOOKUP_URL = TILESET_DIR + 'tile_lookup.json';

export const ATLAS = {
  src: TILESET_DIR + 'platformertiles.png',
  tile: 32,
  cols: 8,
  rows: 3,
};

const loadImage = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

/**
 * Load the atlas (decor/bg) plus the 16 filled-mask tiles named in
 * tile_lookup.json. Always resolves; if the atlas fails, `ready:false` so the
 * renderer uses its coloured-shape fallback (and never calls draw*). A
 * missing filled image falls back to the atlas dirt centre.
 */
export async function loadTileset() {
  const image = await loadImage(ATLAS.src);

  let lookup = null;
  try {
    const res = await fetch(LOOKUP_URL);
    if (res.ok) lookup = await res.json();
  } catch {
    /* offline / missing lookup → filled stays empty, dirt-centre fallback */
  }

  const filled = {};
  if (lookup?.filled) {
    await Promise.all(
      Object.entries(lookup.filled).map(async ([mask, def]) => {
        filled[mask] = await loadImage(TILESET_DIR + def.image);
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
    ready: !!image,
    // Decor / background (atlas-backed, indices < 24).
    drawTile: atlasCrop,
    // Filled terrain: mask 0–15 → its lookup image.
    drawFilled(ctx, mask, dx, dy, size) {
      const im = filled[mask];
      if (im) ctx.drawImage(im, 0, 0, im.width, im.height, dx, dy, size, size);
      else atlasCrop(ctx, 9, dx, dy, size); // missing → dirt centre
    },
  };
}
