// Atlas metadata. CONFIRMED by inspection (design §8 resolved): 256x96, 32px
// tiles, 8x3 = 24 tiles. Layout is a 9-slice dirt block (indices 0,1,2 / 8,9,10
// / 16,17,18) plus sky (11), moon (3) and transparent decor overlays. Full
// per-tile names are in public/.../Dirt_Platformer_Tiles/tiles.json.
export const ATLAS = {
  src: '/data/tilesets/Dirt_Platformer_Tiles/platformertiles.png',
  tile: 32,
  cols: 8,
  rows: 3,
};

// glyph -> tile index (row-major). v1 draws one tile per glyph, so `#` uses
// the solid dirt centre (9). `^` has no spike in this dirt set, so it is left
// unmapped and the renderer draws its coloured-shape fallback. Entities
// (P, o, E) likewise use shape fallbacks — a dirt tileset has no sprites.
export const GLYPH_TILE = {
  '#': 9,
};

// Generated standalone platform tiles (v5): not in the atlas (8x3 has no
// spare slot), addressed by synthetic indices 24-27.
const EXTRA_BASE = '/data/tilesets/Dirt_Platformer_Tiles/tiles/';
const EXTRA = {
  24: EXTRA_BASE + '24_platform_left.png',
  25: EXTRA_BASE + '25_platform_mid_h.png',
  26: EXTRA_BASE + '26_platform_right.png',
  27: EXTRA_BASE + '27_platform_single.png',
};

const loadImage = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

/**
 * Load the atlas plus the standalone platform tiles. Always resolves; if the
 * atlas fails, `ready:false` so the renderer uses its coloured-shape fallback
 * (and never calls drawTile). A missing standalone tile falls back to the
 * atlas dirt centre so a render is still produced.
 */
export async function loadTileset(src = ATLAS.src) {
  const image = await loadImage(src);
  const extra = {};
  await Promise.all(
    Object.entries(EXTRA).map(async ([i, url]) => {
      extra[i] = await loadImage(url);
    }),
  );
  return {
    image,
    ready: !!image,
    tileFor: (glyph) => GLYPH_TILE[glyph],
    drawTile(ctx, index, dx, dy, size) {
      if (index >= 24) {
        const im = extra[index];
        if (im) {
          ctx.drawImage(im, 0, 0, im.width, im.height, dx, dy, size, size);
          return;
        }
        index = 9; // standalone asset missing → sensible dirt fallback
      }
      const sx = (index % ATLAS.cols) * ATLAS.tile;
      const sy = Math.floor(index / ATLAS.cols) * ATLAS.tile;
      ctx.drawImage(image, sx, sy, ATLAS.tile, ATLAS.tile, dx, dy, size, size);
    },
  };
}
