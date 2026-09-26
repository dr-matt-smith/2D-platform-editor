// What the player page is doing. The value is mirrored on
// <body data-state>, so the stylesheet and the e2e specs can see it.
export enum PageState {
  // Fetching the level and its tileset.
  Loading = 'loading',
  // The game owns the canvas and the keyboard.
  Playing = 'playing',
  // Esc was pressed; the level picker has focus.
  Stopped = 'stopped',
  // The level failed the engine's launch gate.
  Invalid = 'invalid',
  // Something could not be fetched.
  Error = 'error',
}
