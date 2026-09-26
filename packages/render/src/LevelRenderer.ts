import { Level, Theme } from '@2d-platform/level-format';
import { CellRange } from './CellRange.ts';
import { Palette } from './Palette.ts';
import { TerrainMask } from './TerrainMask.ts';
import type { LevelData, LevelMeta } from '@2d-platform/level-format';
import type { DrawOptions } from './DrawOptions.ts';
import type { EntityState } from './EntityState.ts';
import type { RenderTileset } from './RenderTileset.ts';

// The level fields the renderer reads. A `Level` fits, and so does a plain
// object (the playtest passes a copy of the grid with collected pickups
// removed).
export type RenderLevel = Pick<LevelData, 'grid' | 'meta'>;

// What one call to `draw` works on, shared by its passes.
interface Frame {
  ctx: CanvasRenderingContext2D;
  grid: readonly string[];
  meta: LevelMeta;
  cells: CellRange;
  now: number | undefined;
  entityState: EntityState | null;
}

// Draws a level onto a 2D canvas with a tileset. The editor preview and
// the playtest both draw through this class, so what the author edits
// looks exactly like what they play.
//
// A level is painted in passes, back to front:
//   1. sky colour, then the level's background image (if it names one);
//   2. sky tiles from the atlas (Dirt only);
//   3. terrain, autotiled by `TerrainMask`;
//   4. decor from the atlas: grass, drips, moon, stars (Dirt only);
//   5. decoration glyphs (under entities);
//   6. entities: player, exit, hazards, pickups;
//   7. foreground glyphs (over entities).
// Wherever the tileset has no sprite, the glyph's `Palette` fallback
// shape is drawn instead, so any level is visible with any tileset.
//
// A band `HUD_HEIGHT_TILES` cells tall is kept free at the top of the
// canvas for the HUD (`drawHud`); the level is drawn below it.
export class LevelRenderer {
  // Height of the HUD band, in cells.
  static readonly HUD_HEIGHT_TILES = 1;

  // Atlas tile numbers used by the sky and decor passes (Dirt's atlas).
  private static readonly ATLAS = Object.freeze({
    sky: 11,
    // Dark dirt fill, the cave theme's background.
    caveBackground: 19,
    moon: 3,
    stars: [13, 14],
    grass: [21, 22],
    drips: [15, 23],
  });

  // `tile` is the size of one cell in canvas pixels.
  constructor(readonly tileset: RenderTileset | null, readonly tile: number = 24) {}

  // Height of the HUD band in canvas pixels.
  get hudHeight(): number {
    return LevelRenderer.HUD_HEIGHT_TILES * this.tile;
  }

  // Draw the fallback shape for `glyph` into the `size`-px cell at (x, y);
  // nothing for a glyph without one.
  static drawFallback(
    ctx: CanvasRenderingContext2D,
    glyph: string,
    x: number,
    y: number,
    size: number,
  ): void {
    Palette.fallbackFor(glyph)?.draw(ctx, x, y, size);
  }

  // Draw `level` onto `ctx`, resizing the canvas to the level (or to the
  // camera's view) plus the HUD band. The canvas transform is restored
  // before returning, so the caller can draw over it in canvas pixels.
  draw(ctx: CanvasRenderingContext2D, level: RenderLevel, options: DrawOptions = {}): void {
    const { grid, meta } = level;
    const camera = options.camera ?? null;
    const tile = this.tile;
    const hudPx = this.hudHeight;
    const w = camera ? camera.viewW : meta.width * tile;
    const h = camera ? camera.viewH : meta.height * tile;
    if (ctx.canvas.width !== w) ctx.canvas.width = w;
    if (ctx.canvas.height !== h + hudPx) ctx.canvas.height = h + hudPx;

    const frame: Frame = {
      ctx,
      grid,
      meta,
      cells: camera
        ? CellRange.visible(camera, tile, grid.length, meta.width)
        : CellRange.all(grid.length, meta.width),
      now: options.now,
      entityState: options.entityState ?? null,
    };

    // The sky fills the whole canvas in canvas pixels, including any part
    // of a view that lies beyond the world.
    ctx.fillStyle = Palette.SKY;
    ctx.fillRect(0, 0, w || 1, (h + hudPx) || 1);

    // Everything else is drawn in world pixels: below the HUD band, then
    // scrolled by the camera (rounded, so tiles stay on whole pixels).
    ctx.save();
    ctx.translate(0, hudPx);
    if (camera) {
      ctx.save();
      ctx.translate(-Math.round(camera.camX), -Math.round(camera.camY));
    }

    this.drawBackgroundImage(frame);
    this.drawSkyTiles(frame);
    const thinCells = this.drawTerrain(frame);
    this.drawDecor(frame, thinCells);
    this.drawDecorations(frame);
    this.drawEntities(frame);
    this.drawForeground(frame);

    if (camera) ctx.restore();
    ctx.restore();
  }

  // Paint the HUD band across the top of the canvas with `text` on it.
  // The colours come from the page's --hud-bg / --hud-fg CSS variables,
  // so the band follows the light / dark theme with no JS listener.
  drawHud(ctx: CanvasRenderingContext2D, text: string | null | undefined): void {
    const hudPx = this.hudHeight;
    let background = Palette.HUD_BACKGROUND;
    let foreground = Palette.HUD_TEXT;
    if (typeof document !== 'undefined' && document.documentElement) {
      const styles = getComputedStyle(document.documentElement);
      background = styles.getPropertyValue('--hud-bg').trim() || background;
      foreground = styles.getPropertyValue('--hud-fg').trim() || foreground;
    }
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, ctx.canvas.width, hudPx);
    ctx.fillStyle = foreground;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text ?? '', 8, hudPx / 2);
    ctx.restore();
  }

  // Draw one entity glyph at canvas position (x, y): its sprite if the
  // tileset has one, else its fallback shape. The playtest uses this for
  // the moving player, so it matches the player the editor shows.
  drawEntity(
    ctx: CanvasRenderingContext2D,
    glyph: string,
    x: number,
    y: number,
    now?: number,
    state?: EntityState | null,
  ): void {
    const spec = this.tileset?.entityFor?.(glyph, now, state);
    if (spec) spec.draw(ctx, x, y, this.tile);
    else LevelRenderer.drawFallback(ctx, glyph, x, y, this.tile);
  }

  // A whole-level background image, stretched over the world. An unknown
  // id draws nothing and the sky colour shows instead.
  private drawBackgroundImage({ ctx, meta }: Frame): void {
    if (!meta.backgroundImage || !this.tileset?.backgroundImage) return;
    const image = this.tileset.backgroundImage(meta.backgroundImage);
    if (image) ctx.drawImage(image, 0, 0, meta.width * this.tile, meta.height * this.tile);
  }

  // A sky (or cave) atlas tile under every cell.
  private drawSkyTiles({ ctx, meta, cells }: Frame): void {
    const tileset = this.tileset;
    if (!tileset?.atlasReady) return;
    const index = meta.theme === Theme.Cave
      ? LevelRenderer.ATLAS.caveBackground
      : LevelRenderer.ATLAS.sky;
    cells.forEach((r, c) => tileset.drawTile(ctx, index, this.x(c), this.y(r), this.tile));
  }

  // Each terrain cell gets the tileset's image for its `TerrainMask`, or
  // the fallback block. Returns the thin cells that got an image (as
  // r * width + c) so the decor pass can leave them alone.
  private drawTerrain({ ctx, grid, meta, cells, now }: Frame): Set<number> {
    const thinCells = new Set<number>();
    cells.forEach((r, c) => {
      if (grid[r][c] !== TerrainMask.GLYPH) return;
      const mask = TerrainMask.at(grid, r, c);
      const spec = this.tileset?.terrainFor?.(mask.value, now);
      if (spec) {
        if (mask.isThin) thinCells.add(r * meta.width + c);
        spec.draw(ctx, this.x(c), this.y(r), this.tile);
      } else {
        LevelRenderer.drawFallback(ctx, TerrainMask.GLYPH, this.x(c), this.y(r), this.tile);
      }
    });
    return thinCells;
  }

  // Atlas decor, placed by a hash of the cell so it never flickers between
  // frames. Drips hang under terrain with space below (both themes); grass,
  // the moon and stars appear only in the sky theme.
  private drawDecor({ ctx, grid, meta, cells }: Frame, thinCells: Set<number>): void {
    const tileset = this.tileset;
    if (!tileset?.atlasReady) return;
    const atlas = LevelRenderer.ATLAS;
    const hash = LevelRenderer.hash;
    const solid = TerrainMask.isSolid;
    const cave = meta.theme === Theme.Cave;
    const rows = grid.length;
    const blit = (index: number, c: number, r: number) =>
      tileset.drawTile(ctx, index, this.x(c), this.y(r), this.tile);
    let mooned = false;
    cells.forEach((r, c) => {
      const g = grid[r][c];
      if (g === TerrainMask.GLYPH) {
        if (thinCells.has(r * meta.width + c)) return; // finished platform art
        if (!cave && !solid(grid, r - 1, c) && r - 1 >= 0) {
          blit(atlas.grass[hash(c, r) & 1], c, r - 1);
        }
        if (!solid(grid, r + 1, c) && r + 1 < rows) {
          blit(atlas.drips[hash(c, r) % 7 === 0 ? 1 : 0], c, r + 1);
        }
      } else if (!cave && g === Level.BACKGROUND_GLYPH) {
        if (!mooned && r <= 2 && c >= grid[r].length - 5) {
          blit(atlas.moon, c, r);
          mooned = true;
        } else if (r < rows * 0.55 && hash(c, r) % 11 === 0) {
          blit(atlas.stars[hash(c, r) & 1], c, r);
        }
      }
    });
  }

  // Decoration glyphs, drawn before entities so the player walks in front
  // of trees and bushes.
  private drawDecorations({ ctx, grid, cells, now }: Frame): void {
    cells.forEach((r, c) => {
      const g = grid[r][c];
      if (!LevelRenderer.isGlyphCell(g)) return;
      this.tileset?.decorationFor?.(g, now)?.draw(ctx, this.x(c), this.y(r), this.tile);
    });
  }

  // Entities: the sprite, else the fallback shape, but never a shape for
  // decoration or foreground glyphs, which the passes either side draw.
  private drawEntities({ ctx, grid, cells, now, entityState }: Frame): void {
    cells.forEach((r, c) => {
      const g = grid[r][c];
      if (!LevelRenderer.isGlyphCell(g)) return;
      const spec = this.tileset?.entityFor?.(g, now, entityState);
      if (spec) {
        spec.draw(ctx, this.x(c), this.y(r), this.tile);
      } else if (!this.tileset?.decorationFor?.(g, now) && !this.tileset?.foregroundFor?.(g, now)) {
        LevelRenderer.drawFallback(ctx, g, this.x(c), this.y(r), this.tile);
      }
    });
  }

  // Foreground glyphs, drawn last so a flag pole stands in front of
  // whatever shares its cell.
  private drawForeground({ ctx, grid, cells, now }: Frame): void {
    cells.forEach((r, c) => {
      const g = grid[r][c];
      if (!LevelRenderer.isGlyphCell(g)) return;
      this.tileset?.foregroundFor?.(g, now)?.draw(ctx, this.x(c), this.y(r), this.tile);
    });
  }

  // Cell position in world pixels.
  private x(c: number): number {
    return c * this.tile;
  }

  private y(r: number): number {
    return r * this.tile;
  }

  // The glyph passes skip empty cells and terrain.
  private static isGlyphCell(glyph: string): boolean {
    return glyph !== Level.BACKGROUND_GLYPH && glyph !== TerrainMask.GLYPH;
  }

  // A stable hash of a cell position, so decor placement is the same on
  // every frame.
  private static hash(x: number, y: number): number {
    let n = (x * 73856093) ^ (y * 19349663);
    n = (n ^ (n >>> 13)) >>> 0;
    return n;
  }
}
