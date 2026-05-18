// Pure renderer: parsed level + tileset in, pixels out. No DOM reads, so it
// is trivially testable and reusable (design §5).
//
// When the atlas is loaded it draws a 9-slice autotiled dirt block plus a
// deterministic decor pass (sky/moon/stars/grass/drips) so authored levels
// resemble the source screenshots (design §10 #6). When the atlas is missing
// it degrades to flat colour + shapes. Entities (P, o, E) and the hazard `^`
// have no sprite in a dirt tileset, so they are always drawn as shapes.
import { BACKGROUND_GLYPH } from './level.js';

const SKY = '#1b2a3a';

// Atlas tile indices (confirmed layout — see tileset.js / tiles.json).
const T = {
  // 9-slice dirt block, row-major (row 0 / 1 / 2):
  dirt: [0, 1, 2, 8, 9, 10, 16, 17, 18],
  sky: 11,
  caveBg: 19, // dirt_fill — dark textured background for cave theme
  moon: 3,
  stars: [13, 14],
  grass: [21, 22],
  drip: [15, 23],
};

// Fallback shapes for the no-atlas path and for sprite-less glyphs.
const FALLBACK = {
  '#': { color: '#6b4a2f', shape: 'block' },
  '^': { color: '#c0392b', shape: 'spike' },
  P: { color: '#3498db', shape: 'disc' },
  o: { color: '#f1c40f', shape: 'pip' },
  E: { color: '#2ecc71', shape: 'block' },
};

// Stable position hash so decor never flickers between renders (keeps draw
// deterministic — same input, same pixels).
function hash(x, y) {
  let n = (x * 73856093) ^ (y * 19349663);
  n = (n ^ (n >>> 13)) >>> 0;
  return n;
}

// Off-grid counts as SOLID: the world is implicit dirt the level is carved
// from, so boundary walls/floor present their rocky face to the play area
// (the player), not off the edge of the map (v4 design §3).
const solid = (grid, r, c) =>
  r < 0 || r >= grid.length || c < 0 || c >= grid[r].length || grid[r][c] === '#';

// 9-slice pick (off-grid solid → see above): row/col select a corner/edge/
// centre tile so the rim faces toward open space (the player side).
export function autotileIndex(grid, r, c) {
  const up = solid(grid, r - 1, c);
  const down = solid(grid, r + 1, c);
  const left = solid(grid, r, c - 1);
  const right = solid(grid, r, c + 1);
  const row = !up ? 0 : !down ? 2 : 1;
  const col = !left ? 0 : !right ? 2 : 1;
  return T.dirt[row * 3 + col];
}

// Platform tile indices (v5). 4/12/20 are the atlas vertical set; 24–27 are
// generated standalone images (3 rotated + 1 composed single). Used for
// 1-cell-thick runs so a thin ledge/pillar/nub reads as a finished platform
// instead of a lopsided 9-slice slice.
export const PLATFORM = new Set([4, 12, 20, 24, 25, 26, 27]);

// Tile pick including thin-run handling (v5 design §4). Pure; returns a plain
// index. First match wins; the non-thin path delegates to autotileIndex so
// thick/boundary walls are byte-for-byte unchanged from v4.
export function pickTile(grid, r, c) {
  const up = solid(grid, r - 1, c);
  const down = solid(grid, r + 1, c);
  const left = solid(grid, r, c - 1);
  const right = solid(grid, r, c + 1);

  if (!up && !down && !left && !right) return 27; // isolated 1×1
  if (!left && !right) return !up ? 4 : !down ? 20 : 12; // 1-wide column
  if (!up && !down) return !left ? 24 : !right ? 26 : 25; // 1-tall row
  return autotileIndex(grid, r, c); // thick / boundary → v4 9-slice
}

function drawFallback(ctx, glyph, x, y, t) {
  const f = FALLBACK[glyph];
  if (!f) return; // unknown glyph: leave as background (validator flags it)
  ctx.fillStyle = f.color;
  if (f.shape === 'block') {
    ctx.fillRect(x, y, t, t);
  } else if (f.shape === 'spike') {
    ctx.beginPath();
    ctx.moveTo(x, y + t);
    ctx.lineTo(x + t / 2, y);
    ctx.lineTo(x + t, y + t);
    ctx.closePath();
    ctx.fill();
  } else {
    const r = f.shape === 'disc' ? t * 0.4 : t * 0.18;
    ctx.beginPath();
    ctx.arc(x + t / 2, y + t / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw a parsed level to a 2D canvas context.
 * @param ctx CanvasRenderingContext2D
 * @param parsed result of level.parse()
 * @param tileset result of loadTileset() (may be null / ready:false)
 * @param tile pixel size per cell
 */
export function draw(ctx, parsed, tileset, tile = 24) {
  const { grid, meta } = parsed;
  const w = meta.width * tile;
  const h = meta.height * tile;
  if (ctx.canvas.width !== w) ctx.canvas.width = w;
  if (ctx.canvas.height !== h) ctx.canvas.height = h;

  const ready = !!tileset?.ready;
  const cave = meta.theme === 'cave';
  const px = (c) => c * tile;
  const py = (r) => r * tile;
  const blit = (idx, c, r) => tileset.drawTile(ctx, idx, px(c), py(r), tile);

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, w || 1, h || 1);

  // Pass 1: background. With an atlas, fill every cell with the sky tile so
  // the palette matches; without one the flat SKY rect above is enough.
  if (ready) {
    const bg = cave ? T.caveBg : T.sky;
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) blit(bg, c, r);
  }

  // Pass 2: terrain. Autotiled dirt with the atlas, flat blocks without.
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== '#') continue;
      if (ready) blit(autotileIndex(grid, r, c), c, r);
      else drawFallback(ctx, '#', px(c), py(r), tile);
    }
  }

  // Pass 3: decor (atlas only). Drips hang under any dirt with open space
  // below (both themes). Grass + moon + stars are sky-theme only.
  if (ready) {
    const rows = grid.length;
    let mooned = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const g = grid[r][c];
        if (g === '#') {
          if (!cave && !solid(grid, r - 1, c) && r - 1 >= 0)
            blit(T.grass[hash(c, r) & 1], c, r - 1);
          if (!solid(grid, r + 1, c) && r + 1 < rows)
            blit(T.drip[hash(c, r) % 7 === 0 ? 1 : 0], c, r + 1);
        } else if (!cave && g === BACKGROUND_GLYPH) {
          if (!mooned && r <= 2 && c >= grid[r].length - 5) {
            blit(T.moon, c, r);
            mooned = true;
          } else if (r < rows * 0.55 && hash(c, r) % 11 === 0) {
            blit(T.stars[hash(c, r) & 1], c, r);
          }
        }
      }
    }
  }

  // Pass 4: entities + hazard, always shapes (no sprites in a dirt tileset).
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const g = grid[r][c];
      if (g === BACKGROUND_GLYPH || g === '#') continue;
      drawFallback(ctx, g, px(c), py(r), tile);
    }
  }
}
