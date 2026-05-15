// Pure renderer: parsed level + tileset in, pixels out. No DOM reads, so it
// is trivially testable and reusable (design §5).
import { BACKGROUND_GLYPH } from './level.js';

const SKY = '#1b2a3a';

// Fallback shapes for glyphs not backed by an atlas tile (or when the atlas
// failed to load). Keyed by glyph; `shape` picks the draw routine.
const FALLBACK = {
  '#': { color: '#6b4a2f', shape: 'block' },
  '^': { color: '#c0392b', shape: 'spike' },
  P: { color: '#3498db', shape: 'disc' },
  o: { color: '#f1c40f', shape: 'pip' },
  E: { color: '#2ecc71', shape: 'block' },
};

function drawFallback(ctx, glyph, x, y, t) {
  const f = FALLBACK[glyph];
  if (!f) return; // unknown glyph: leave as sky (validator will flag it)
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
  } else if (f.shape === 'disc' || f.shape === 'pip') {
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
 * @param tileset result of loadTileset() (may be ready:false)
 * @param tile pixel size per cell
 */
export function draw(ctx, parsed, tileset, tile = 24) {
  const { grid, meta } = parsed;
  const w = meta.width * tile;
  const h = meta.height * tile;
  if (ctx.canvas.width !== w) ctx.canvas.width = w;
  if (ctx.canvas.height !== h) ctx.canvas.height = h;

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, w || 1, h || 1);

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const glyph = grid[row][col];
      if (glyph === BACKGROUND_GLYPH) continue;
      const px = col * tile;
      const py = row * tile;
      const tileIndex = tileset?.ready ? tileset.tileFor(glyph) : undefined;
      if (tileIndex !== undefined) {
        tileset.drawTile(ctx, tileIndex, px, py, tile);
      } else {
        drawFallback(ctx, glyph, px, py, tile);
      }
    }
  }
}
