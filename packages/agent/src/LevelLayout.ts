import type { Cell } from './Cell.ts';

/**
 * Where things are in a level: the settled spawn cell, the pickups and
 * the exits, and the grid size. Every plan carries one (the editor's
 * overlay draws from it).
 */
export interface LevelLayout {
  /** The cell the player settles on after spawning, or null if none. */
  start: Cell | null;
  pickupCells: Cell[];
  exitCells: Cell[];
  width: number;
  height: number;
}
