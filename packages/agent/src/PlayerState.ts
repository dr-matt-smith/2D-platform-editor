/** A position in world pixels (the player's AABB top-left). */
export interface Point {
  x: number;
  y: number;
}

/** A velocity in pixels per second. */
export interface Velocity {
  vx: number;
  vy: number;
}

/**
 * The player's exact continuous-physics state: AABB top-left, velocity
 * and whether it stands on something. The same shape the engine's
 * `setPlayerState` takes, so a simulation can resume exactly where
 * another stopped.
 */
export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

/** The scene's live player: its state plus its AABB size. */
export interface PlayerBody extends PlayerState {
  w: number;
  h: number;
}
