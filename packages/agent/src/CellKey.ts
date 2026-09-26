import type { Cell } from './Cell.ts';

/**
 * The "r,c" text form of a cell. Plan goals are stored as cell keys, and
 * the searches use them as map keys and goal targets.
 */
export class CellKey {
  private constructor() {}

  /** "r,c" for a cell. */
  static of(r: number, c: number): string {
    return `${r},${c}`;
  }

  /** The cell a key names (reads the first two parts, so a StateKey also works). */
  static parse(key: string): Cell {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  }
}
