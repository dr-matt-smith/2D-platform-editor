// Atlas metadata. The image is 256x96; 32px tiles give an 8x3 grid (24 tiles).
// NOTE: the per-glyph tile indices below are ASSUMED from the image size and
// the OpenGameArt source — not yet visually confirmed (design §8). They are
// centralised here so a corrected mapping is a one-line change, and the
// renderer falls back to coloured shapes for anything not mapped.
export const ATLAS = {
  src: '/assets/tilesets/Dirt_Platformer_Tiles/platformertiles.png',
  tile: 32,
  cols: 8,
  rows: 3,
};

// glyph -> tile index (row-major) in the atlas. Only terrain is mapped;
// entities (P, o, E) are drawn as shapes since a dirt tileset has no sprites.
export const GLYPH_TILE = {
  '#': 0,
  '^': 1,
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
