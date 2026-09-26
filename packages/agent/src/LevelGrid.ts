import { TILE } from './constants.ts';
import { GlyphRole } from './GlyphRole.ts';
import type { Cell } from './Cell.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { Point } from './PlayerState.ts';

/**
 * A level's grid seen through its legend: what role each cell has, where
 * the player can stand, and where the spawn, pickups and exits are. Both
 * planners read the level through this class.
 */
export class LevelGrid {
  // The classic glyphs, used only when no legend is given. With a legend,
  // roles come from the legend alone — exactly as the engine reads them —
  // so a tileset that remaps glyphs (say '@' for the player) plans correctly.
  private static readonly DEFAULT_ROLES: Readonly<Record<string, GlyphRole>> = {
    '#': GlyphRole.Terrain,
    '^': GlyphRole.Hazard,
    P: GlyphRole.Player,
    E: GlyphRole.Exit,
    o: GlyphRole.Pickup,
  };

  private readonly rows: readonly string[];

  constructor(private readonly level: ParsedLevel, private readonly legend: LegendRecord | null = null) {
    this.rows = level.grid;
  }

  /** The role of glyph `ch`: from `legend`, or the classic glyphs without one. */
  static glyphRole(legend: LegendRecord | null | undefined, ch: string): string | null {
    if (!legend) return LevelGrid.DEFAULT_ROLES[ch] ?? null;
    return legend[ch]?.role ?? null;
  }

  /**
   * The cell under the centre of a player-sized box at `pos` (the box is
   * one TILE square).
   */
  static cellAt(pos: Point): Cell {
    return {
      r: Math.floor((pos.y + TILE / 2) / TILE),
      c: Math.floor((pos.x + TILE / 2) / TILE),
    };
  }

  /** The first exit cell a player-sized box at `pos` overlaps, or null. */
  static exitOverlapping(pos: Point, exitCells: readonly Cell[]): Cell | null {
    for (const ec of exitCells) {
      const ax = pos.x;
      const ay = pos.y;
      const bx = ec.c * TILE;
      const by = ec.r * TILE;
      if (ax < bx + TILE && ax + TILE > bx && ay < by + TILE && ay + TILE > by) {
        return ec;
      }
    }
    return null;
  }

  /** Number of rows. */
  get height(): number {
    return this.rows.length;
  }

  /** The level's declared width in cells. */
  get width(): number {
    return this.level.meta.width;
  }

  /** The role of the glyph at (r, c). */
  roleAt(r: number, c: number): string | null {
    return LevelGrid.glyphRole(this.legend, this.rows[r][c]);
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.rows.length && c >= 0 && c < this.rows[r].length;
  }

  // Terrain is solid and hazards kill, so neither is a cell the player can occupy.
  isWalkable(r: number, c: number): boolean {
    if (!this.inBounds(r, c)) return false;
    const role = this.roleAt(r, c);
    return role !== GlyphRole.Terrain && role !== GlyphRole.Hazard;
  }

  /** Is there terrain directly below (r, c)? */
  isGrounded(r: number, c: number): boolean {
    return this.inBounds(r + 1, c) && this.roleAt(r + 1, c) === GlyphRole.Terrain;
  }

  /** Where a player dropped at (r, c) comes to rest, or null if it falls out of the level. */
  settle(r: number, c: number): Cell | null {
    let cur = r;
    while (cur < this.rows.length && this.isWalkable(cur, c) && !this.isGrounded(cur, c)) {
      cur++;
    }
    if (cur >= this.rows.length) return null;
    if (!this.isWalkable(cur, c)) return null;
    return { r: cur, c };
  }

  /** Does any glyph have the player role? (The engine needs a spawn to build a scene.) */
  hasPlayerGlyph(): boolean {
    for (const row of this.rows) {
      for (const ch of row) {
        if (LevelGrid.glyphRole(this.legend, ch) === GlyphRole.Player) return true;
      }
    }
    return false;
  }

  /**
   * Scan the walkable cells, row by row, for the spawn, pickups and exits.
   * The player spawns in mid-air and falls, so the start is the cell it
   * settles on.
   */
  findLayout(): LevelLayout {
    let spawn: Cell | null = null;
    const pickupCells: Cell[] = [];
    const exitCells: Cell[] = [];
    for (let r = 0; r < this.rows.length; r++) {
      for (let c = 0; c < this.rows[r].length; c++) {
        if (!this.isWalkable(r, c)) continue;
        const role = this.roleAt(r, c);
        if (role === GlyphRole.Player) spawn = { r, c };
        else if (role === GlyphRole.Exit) exitCells.push({ r, c });
        else if (role === GlyphRole.Pickup) pickupCells.push({ r, c });
      }
    }
    const start = spawn ? this.settle(spawn.r, spawn.c) : null;
    return { start, pickupCells, exitCells, width: this.width, height: this.height };
  }
}
