// Atlas metadata. CONFIRMED by inspection (design §8 resolved): 256x96, 32px
// tiles, 8x3 = 24 tiles. Layout is a 9-slice dirt block (indices 0,1,2 / 8,9,10
// / 16,17,18) plus sky (11), moon (3) and transparent decor overlays. Full
// per-tile names are in public/.../Dirt_Platformer_Tiles/tiles.json.
export const ATLAS = {
  src: '/assets/tilesets/Dirt_Platformer_Tiles/platformertiles.png',
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

/**
 * Load the atlas. Always resolves: on image error it resolves with
 * ready:false so the renderer degrades to coloured-shape fallback.
 */
export function loadTileset(src = ATLAS.src) {
  return new Promise((resolve) => {
    const image = new Image();
    const api = {
      image,
      ready: false,
      tileFor: (glyph) => GLYPH_TILE[glyph],
      drawTile(ctx, index, dx, dy, size) {
        const sx = (index % ATLAS.cols) * ATLAS.tile;
        const sy = Math.floor(index / ATLAS.cols) * ATLAS.tile;
        ctx.drawImage(image, sx, sy, ATLAS.tile, ATLAS.tile, dx, dy, size, size);
      },
    };
    image.onload = () => {
      api.ready = true;
      resolve(api);
    };
    image.onerror = () => resolve(api);
    image.src = src;
  });
}
