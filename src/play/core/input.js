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
export class Input {
  constructor() {
    this.held    = new Set();
    this.pressed = new Set();

    this._onKeyDown = (e) => {
      const k = normalise(e.key);
      if (!k) return;
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
      // Stop space/arrows scrolling the page.
      if (k === "space" || k === "up" || k === "down" || k === "left" || k === "right") {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      const k = normalise(e.key);
      if (k) this.held.delete(k);
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  /** True for as long as the key is held down. */
  isDown(key)     { return this.held.has(key); }
  /** True for exactly one frame after the key is first pressed. */
  wasPressed(key) { return this.pressed.has(key); }
  /** Called by Game at the end of each frame to clear the just-pressed set. */
  endFrame()      { this.pressed.clear(); }

  /** v9 fork: detach the window listeners (playtest teardown, TDD §7). */
  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}

function normalise(k) {
  if (k === " ")          return "space";
  if (k === "ArrowLeft")  return "left";
  if (k === "ArrowRight") return "right";
  if (k === "ArrowUp")    return "up";
  if (k === "ArrowDown")  return "down";
  if (k.length === 1)     return k.toLowerCase();
  return null;
}
