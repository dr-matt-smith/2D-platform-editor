/**
 * Keyboard input. Tracks two pieces of state:
 *   - `held`    : keys currently down (for continuous actions like running)
 *   - `pressed` : keys that just transitioned from up to down this frame
 *                 (for one-shot actions like jump). Cleared each frame by
 *                 the Game loop calling `endFrame()`.
 *
 * Key names are normalised — arrows become "left"/"right"/"up"/"down" and
 * Space becomes "space", so scenes write `isDown("left")` rather than
 * caring about KeyboardEvent.key strings.
 *
 * VENDORED from simple-platformer-1@4c3b936. Fork (TDD v9 §7): the
 * keydown/keyup handlers are kept as refs so `dispose()` can detach them
 * — the editor opens/closes playtest repeatedly and upstream never removed
 * these window listeners.
 */

/** The normalised non-character key names `Input` produces. */
export type NamedKey = "left" | "right" | "up" | "down" | "space";

/**
 * A normalised key name: a `NamedKey`, or any single printable character
 * lower-cased (e.g. "r", "1"). `(string & {})` keeps editor completion
 * for the named keys while still accepting the character keys.
 */
export type KeyName = NamedKey | (string & {});

/**
 * The shape the game loop and entities read input through. Implemented by
 * the keyboard `Input` below and by `ScriptedInput` (recorded playback).
 */
export interface InputSource {
  isDown(key: KeyName): boolean;
  wasPressed(key: KeyName): boolean;
  endFrame(): void;
  dispose(): void;
}

export class Input implements InputSource {
  declare held: Set<KeyName>;
  declare pressed: Set<KeyName>;
  declare _onKeyDown: (e: KeyboardEvent) => void;
  declare _onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.held    = new Set();
    this.pressed = new Set();

    this._onKeyDown = (e: KeyboardEvent) => {
      const k = normalise(e.key);
      if (!k) return;
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
      // Stop space/arrows scrolling the page.
      if (k === "space" || k === "up" || k === "down" || k === "left" || k === "right") {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      const k = normalise(e.key);
      if (k) this.held.delete(k);
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  /** True for as long as the key is held down. */
  isDown(key: KeyName): boolean     { return this.held.has(key); }
  /** True for exactly one frame after the key is first pressed. */
  wasPressed(key: KeyName): boolean { return this.pressed.has(key); }
  /** Called by Game at the end of each frame to clear the just-pressed set. */
  endFrame(): void      { this.pressed.clear(); }

  /** v9 fork: detach the window listeners (playtest teardown, TDD §7). */
  dispose(): void {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}

function normalise(k: string): KeyName | null {
  if (k === " ")          return "space";
  if (k === "ArrowLeft")  return "left";
  if (k === "ArrowRight") return "right";
  if (k === "ArrowUp")    return "up";
  if (k === "ArrowDown")  return "down";
  if (k.length === 1)     return k.toLowerCase();
  return null;
}
