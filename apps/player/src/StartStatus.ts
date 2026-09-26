// What happened when PlaySession tried to start a level.
export enum StartStatus {
  // The game is running on the canvas.
  Playing = 'playing',
  // The engine's launch gate refused the level (see StartResult.reasons).
  Invalid = 'invalid',
  // Stopped, or overtaken by a newer start(), before it could launch.
  Cancelled = 'cancelled',
}
