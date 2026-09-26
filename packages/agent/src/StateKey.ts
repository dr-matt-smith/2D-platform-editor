import { TILE } from './constants.ts';
import { XOffsetBucket } from './XOffsetBucket.ts';
import type { Cell } from './Cell.ts';
import type { PlayerState } from './PlayerState.ts';

/**
 * The identity of a node in the bucket planner's NavGraph: a cell plus a
 * coarse description of how the player is moving through it — a
 * horizontal-speed bucket (-1, 0, +1) and which third of the cell the
 * player is in. Its text form, "r,c,vx,xo" (e.g. "5,7,1,L"), keys the
 * graph's maps.
 */
export class StateKey {
  /** Horizontal speed buckets: moving left, (almost) still, moving right. */
  static readonly VX_BUCKETS: readonly number[] = [-1, 0, +1];
  /** Sub-cell x buckets, left to right. */
  static readonly X_OFFSET_BUCKETS: readonly XOffsetBucket[] = [
    XOffsetBucket.Left,
    XOffsetBucket.Centre,
    XOffsetBucket.Right,
  ];

  private constructor(
    readonly r: number,
    readonly c: number,
    readonly vxBucket: number,
    readonly xOffsetBucket: XOffsetBucket,
  ) {}

  /** The key for a cell and buckets (default: still, left third). */
  static of(r: number, c: number, vxBucket = 0, xOffsetBucket: XOffsetBucket = XOffsetBucket.Left): StateKey {
    return new StateKey(r, c, vxBucket, xOffsetBucket);
  }

  /** Reads "r,c,vx,xo" text back into a key. Throws on a malformed key. */
  static parse(text: string): StateKey {
    const [rStr, cStr, vxStr, xOff] = text.split(',');
    const xOffsetBucket = StateKey.X_OFFSET_BUCKETS.find((b) => b === xOff);
    if (xOffsetBucket === undefined) throw new Error(`not a state key: "${text}"`);
    return new StateKey(Number(rStr), Number(cStr), Number(vxStr), xOffsetBucket);
  }

  /** The key the player's exact state falls in (cell under the AABB centre). */
  static ofState(state: PlayerState): StateKey {
    return new StateKey(
      Math.floor((state.y + TILE / 2) / TILE),
      Math.floor((state.x + TILE / 2) / TILE),
      StateKey.vxBucketOf(state.vx),
      StateKey.xOffsetBucketOf(state.x),
    );
  }

  /** Bucket a horizontal speed: |vx| < 30 counts as still, so a settled spawn is bucket 0. */
  static vxBucketOf(vx: number): number {
    if (Math.abs(vx) < 30) return 0;
    return vx < 0 ? -1 : +1;
  }

  /**
   * Which third of its cell an AABB-left x is in: [0, TILE/3) is left,
   * [TILE/3, 2*TILE/3) centre, the rest right. The double modulo keeps
   * negative x in range.
   */
  static xOffsetBucketOf(x: number): XOffsetBucket {
    const sub = ((x % TILE) + TILE) % TILE;
    if (sub < TILE / 3) return XOffsetBucket.Left;
    if (sub < (2 * TILE) / 3) return XOffsetBucket.Centre;
    return XOffsetBucket.Right;
  }

  /**
   * A representative AABB-left x for a bucket of column `c`. Left is the
   * cell's left edge exactly (so the common case starts on whole pixels);
   * centre and right sit mid-bucket, so a simulation started there doesn't
   * immediately drift into a neighbouring bucket.
   */
  static bucketCentreX(c: number, xOffsetBucket: XOffsetBucket): number {
    const baseX = c * TILE;
    if (xOffsetBucket === XOffsetBucket.Left) return baseX;            // sub-pixel 0
    if (xOffsetBucket === XOffsetBucket.Centre) return baseX + TILE / 2; // sub-pixel TILE/2
    return baseX + (5 * TILE) / 6;                                     // sub-pixel 5*TILE/6
  }

  /** The key's cell. */
  get cell(): Cell {
    return { r: this.r, c: this.c };
  }

  /** "r,c,vx,xo" — the form used as a map key. */
  toString(): string {
    return `${this.r},${this.c},${this.vxBucket},${this.xOffsetBucket}`;
  }
}
