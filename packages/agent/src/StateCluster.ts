import type { PlayerState } from './PlayerState.ts';

/** Per-value cluster tolerances: px for x and y, px/s for vx and vy. */
export interface ClusterTolerance {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

/**
 * Groups nearly identical exact states so the per-frame A* treats them
 * as one node — otherwise every sub-pixel difference would be a new
 * node and the search would never end. Each value is rounded to its
 * tolerance; `onGround` must match exactly, because physics branches
 * sharply on it.
 */
export class StateCluster {
  /** Half a pixel of position, 5 px/s of speed. */
  static readonly DEFAULT_TOLERANCE: ClusterTolerance = Object.freeze({
    x: 0.5,
    y: 0.5,
    vx: 5,
    vy: 5,
  });

  private constructor() {}

  /** The cluster's key: the five rounded values joined into a string. */
  static keyOf(state: PlayerState, tol: ClusterTolerance = StateCluster.DEFAULT_TOLERANCE): string {
    const cx = Math.round(state.x / tol.x);
    const cy = Math.round(state.y / tol.y);
    const cvx = Math.round(state.vx / tol.vx);
    const cvy = Math.round(state.vy / tol.vy);
    return `${cx},${cy},${cvx},${cvy},${state.onGround ? 1 : 0}`;
  }

  /** Are two states in the same cluster? */
  static nearby(a: PlayerState, b: PlayerState, tol: ClusterTolerance = StateCluster.DEFAULT_TOLERANCE): boolean {
    return StateCluster.keyOf(a, tol) === StateCluster.keyOf(b, tol);
  }
}
