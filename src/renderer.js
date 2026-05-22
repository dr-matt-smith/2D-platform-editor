// Pure renderer: parsed level + tileset in, pixels out. No DOM reads, so it
// is trivially testable and reusable (design §5).
//
// v10 lifted the v8 "atlas-or-shape" all-or-nothing gate. v11 extends the
// accessor contract from "Image" to a **draw spec** {image,sx,sy,sw,sh}
// so sprite sheets can be cropped to one frame, and adds a decoration
// pass:
//
//   Pass 0a (v18): meta.backgroundImage ? drawImage stretched : skip
//                  (the always-on SKY fillRect is the safe fallback)
//   background:  `atlasReady` ? blit sky/cave atlas tile : skip (SKY rect
//                already painted by the always-on first pass)
//   terrain (#): tileset.terrainFor(mask) ?? drawFallback('#')
//   decor:       `atlasReady` only — Dirt-only data (v8 decor limit,
//                preserved; v11+ lifts decor data into the lookup)
//   Pass 4a decorations: tileset.decorationFor(char) drawn UNDER entities
//   Pass 4b entities:    tileset.entityFor(char) ?? drawFallback(char)
//   Pass 4c (v18):       tileset.foregroundFor(char) drawn OVER entities
//
// Dirt's render is byte-identical: `frames` defaults to 1, so each spec
// covers the whole image — same drawImage args as the v10 path. Dirt's
// entity glyphs declare `image: null` so entityFor returns null and the
// shape path runs as before.
import { BACKGROUND_GLYPH } from './level.js';
import { SKY, FALLBACK } from './palette.js';

// Atlas decor indices (confirmed Dirt-atlas layout — see tileset.js / tiles.json).
const T = {
  sky: 11,
  caveBg: 19, // dirt_fill — dark textured background for cave theme
  moon: 3,
  stars: [13, 14],
  grass: [21, 22],
  drip: [15, 23],
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

// 4-neighbour autotile mask (v7 design §4). Pure; returns 0–15.
// Bit order (clockwise NESW): mask = N·1 + E·2 + S·4 + W·8, a bit set when
// that neighbour is solid. Off-grid is solid (see `solid`, v4 §3). This one
// table replaces the v4/v5 pickTile/autotileIndex/PLATFORM special cases.
export function tileMask(grid, r, c) {
  return (
    (solid(grid, r - 1, c) ? 1 : 0) | // N
    (solid(grid, r, c + 1) ? 2 : 0) | // E
    (solid(grid, r + 1, c) ? 4 : 0) | // S
    (solid(grid, r, c - 1) ? 8 : 0) //  W
  );
}

// "Thin" masks (single / four caps / mid-v / mid-h) — exactly the old v5
// PLATFORM-cell set. The decor pass leaves these finished platform tiles
// alone (only consulted when the decor pass runs, i.e. atlas-driven).
export const THIN = new Set([0, 1, 2, 4, 5, 8, 10]);

/**
 * Image-less shape fallback for a glyph (e.g. Dirt's blue-disc player,
 * red-triangle spike). Exported (v14) so the playtest overlay can reuse
 * the same shape path the editor preview uses, keeping the two views
 * pixel-equivalent for sprite-less glyphs.
 */
export function drawFallback(ctx, glyph, x, y, t) {
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

// Draw a tileset draw-spec into a single tile cell. The spec carries
// the source sub-region (so animation sheets render one frame, not a
// squashed strip — v11 §8). For specs without `frames`, sw/sh equal
// the image's natural size and the args match the v10 path exactly.
const blitImage = (ctx, spec, x, y, t) =>
  ctx.drawImage(spec.image, spec.sx, spec.sy, spec.sw, spec.sh, x, y, t, t);

/**
 * Draw a parsed level to a 2D canvas context.
 * @param ctx CanvasRenderingContext2D
 * @param parsed result of level.parse()
 * @param tileset result of loadTileset() (may be null / atlasReady:false)
 * @param tile pixel size per cell
 */
/**
 * Draw a parsed level via the active tileset.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{grid: string[], meta: object}} parsed
 * @param {object|null} tileset  result of `loadTileset()`
 * @param {number} [tile=24]     pixel size per cell
 * @param {number} [now]         optional `performance.now()` for animated
 *   sprite frames (TDD v16). Omitted → animated entries resolve to frame 0,
 *   making the editor preview deterministic / static. Playtest passes
 *   `performance.now()` to drive multi-frame playback.
 * @param {{camX:number,camY:number,viewW:number,viewH:number}|null} [camera]
 *   v19: when non-null, the canvas is sized to the viewport (not the
 *   world), the context is translated by -cam BEFORE world drawing, and
 *   the per-cell loops are *cell-culled* to the visible band (with 1
 *   cell of bleed on each side so partial-tile edges + neighbour-aware
 *   decor passes still paint correctly). When null (the editor preview
 *   + fit-mode playtest paths), behaviour is byte-identical to v18.
 * @param {{exitLocked?:boolean}|null} [entityState]
 *   v22.1: runtime state forwarded to `tileset.entityFor(char, now,
 *   state)` so glyphs can swap to a LOCKED variant (currently used
 *   by `E` when `pickup-required` isn't met). Null / absent =
 *   primary image always — the editor preview takes this path so the
 *   author always sees the unlocked sprite while editing.
 */
export function draw(ctx, parsed, tileset, tile = 24, now, camera = null, entityState = null) {
  const { grid, meta } = parsed;
  const worldW = meta.width * tile;
  const worldH = meta.height * tile;
  // v19: canvas sized to viewport when scrolling, to world otherwise.
  const w = camera ? camera.viewW : worldW;
  const h = camera ? camera.viewH : worldH;
  if (ctx.canvas.width !== w) ctx.canvas.width = w;
  if (ctx.canvas.height !== h) ctx.canvas.height = h;

  const atlasReady = !!tileset?.atlasReady;
  const cave = meta.theme === 'cave';
  const px = (c) => c * tile;
  const py = (r) => r * tile;

  // v19: cell-iteration range. When camera is null, this spans the
  // whole grid (= the v18 loops, byte-identical). When set, only the
  // visible band plus 1 cell of bleed on each side — the bleed lets
  // partial-tile edges paint cleanly AND lets the neighbour-aware
  // Pass 3 (atlas decor) seed grass/drips from `#` cells just past
  // the viewport edge.
  let r0 = 0;
  let r1 = grid.length;
  let c0 = 0;
  let c1 = meta.width;
  if (camera) {
    c0 = Math.max(0, Math.floor(camera.camX / tile) - 1);
    r0 = Math.max(0, Math.floor(camera.camY / tile) - 1);
    c1 = Math.min(meta.width, Math.ceil((camera.camX + camera.viewW) / tile) + 1);
    r1 = Math.min(grid.length, Math.ceil((camera.camY + camera.viewH) / tile) + 1);
  }

  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, w || 1, h || 1);

  // v19: shift world coords into viewport space. All subsequent world-
  // coord draws (Pass 0a … 4c) are translated by -cam; the SKY fill
  // above stays in screen space (it fills the canvas, including any
  // area outside the world when viewport > world).
  if (camera) {
    ctx.save();
    ctx.translate(-Math.round(camera.camX), -Math.round(camera.camY));
  }

  // Pass 0a (v18): whole-rectangle background image, stretched to fill
  // the level area, painted OVER the SKY fillRect so the rect is the
  // safe fallback when the lookup didn't author one. The directive
  // (`# background-image:`) names a tileset.images entry by stable ID;
  // unknown IDs degrade silently to the SKY fillRect.
  if (meta.backgroundImage && tileset?.backgroundImage) {
    const bg = tileset.backgroundImage(meta.backgroundImage);
    if (bg) ctx.drawImage(bg, 0, 0, worldW, worldH);
  }

  // Pass 1: background sky-tile blit (atlas-driven; Dirt-only).
  if (atlasReady) {
    const bg = cave ? T.caveBg : T.sky;
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) tileset.drawTile(ctx, bg, px(c), py(r), tile);
  }

  // Pass 2: terrain (#). Per-cell: tileset.terrainFor(mask) → image, else
  // shape fallback. THIN cells are recorded for the decor pass below
  // regardless of source — the pass only reads `thinCells` when atlas-
  // driven, so non-atlas tilesets pay only a Set.add cost.
  const thinCells = new Set();
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (grid[r][c] !== '#') continue;
      const m = tileMask(grid, r, c);
      const im = tileset?.terrainFor?.(m, now);
      if (im) {
        if (THIN.has(m)) thinCells.add(r * meta.width + c);
        blitImage(ctx, im, px(c), py(r), tile);
      } else {
        drawFallback(ctx, '#', px(c), py(r), tile);
      }
    }
  }

  // Pass 3: decor (atlas-driven; Dirt-only — v8 decor limit, design §5).
  // Drips hang under any dirt with open space below (both themes). Grass +
  // moon + stars are sky-theme only.
  if (atlasReady) {
    const rows = grid.length;
    const blit = (idx, c, r) => tileset.drawTile(ctx, idx, px(c), py(r), tile);
    let mooned = false;
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const g = grid[r][c];
        if (g === '#') {
          if (thinCells.has(r * meta.width + c)) continue; // finished art
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

  // Pass 4a: decorations (v11 §4.3). Drawn BEFORE entities so a player
  // walking through trees reads as "in front of the tree". Decoration
  // chars are inert at the playtest level (the adapter ignores them);
  // here we just place their sprite. `decorationFor` returns null for
  // non-decoration chars so this loop is cheap on tilesets without any.
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const g = grid[r][c];
      if (g === BACKGROUND_GLYPH || g === '#') continue;
      const spec = tileset?.decorationFor?.(g, now);
      if (spec) blitImage(ctx, spec, px(c), py(r), tile);
    }
  }

  // Pass 4b: entities + hazard. Per-cell: tileset.entityFor(char) →
  // spec, else colour-shape fallback. entityFor returns null for any
  // char that's a decoration OR foreground (v18), so Pass 4a / 4c's
  // cells aren't double-drawn here.
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const g = grid[r][c];
      if (g === BACKGROUND_GLYPH || g === '#') continue;
      const spec = tileset?.entityFor?.(g, now, entityState);
      if (spec) blitImage(ctx, spec, px(c), py(r), tile);
      else if (
        !tileset?.decorationFor?.(g, now) &&
        !tileset?.foregroundFor?.(g, now)
      ) {
        // Only fall back to shape when the cell isn't an entity,
        // background-decoration, or foreground-decoration —
        // decorations are drawn by Pass 4a / 4c.
        drawFallback(ctx, g, px(c), py(r), tile);
      }
    }
  }

  // Pass 4c (v18): foreground decoration glyphs (role: "foreground").
  // Drawn AFTER entities + player so a Flag Pole etc. sits in front
  // of the cell's interactable tile + any entity that occupies it.
  // `foregroundFor` returns null for non-foreground chars so this
  // loop is cheap on tilesets without any.
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const g = grid[r][c];
      if (g === BACKGROUND_GLYPH || g === '#') continue;
      const spec = tileset?.foregroundFor?.(g, now);
      if (spec) blitImage(ctx, spec, px(c), py(r), tile);
    }
  }

  // v19: restore the pre-translate matrix so callers can overlay HUD /
  // banner / player sprite in screen coords (PlaytestScene applies its
  // own translate to the player overlay; the banner + HUD then paint
  // in viewport coords once the world translate is gone).
  if (camera) ctx.restore();
}
