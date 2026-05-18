// Single source for the renderer's flat colours (design §11 #2). v8 also
// stores these colours in each tileset's tile_lookup.json `glyphs` (so the
// thumbnail legend and any future tileset can carry its own swatches); the
// drift-guard test (palette.test.js) asserts the two never diverge. v9 "2c"
// retires this duplication by having the renderer read the colour from the
// loaded lookup directly.
export const SKY = '#1b2a3a';

// Fallback shapes/colours for the no-atlas path and for sprite-less glyphs
// (entities + the hazard `^` have no sprite in a dirt tileset).
export const FALLBACK = {
  '#': { color: '#6b4a2f', shape: 'block' },
  '^': { color: '#c0392b', shape: 'spike' },
  P: { color: '#3498db', shape: 'disc' },
  o: { color: '#f1c40f', shape: 'pip' },
  E: { color: '#2ecc71', shape: 'block' },
};
