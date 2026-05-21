// Scripted input source for v20's agent + Demo mode. Implements the v9
// `Input` shape (isDown / wasPressed / endFrame / dispose) but reads
// from a recording instead of the keyboard.
//
// The vendored `Input` (TDD v9 §7, byte-identical to upstream) is
// untouched; this sibling class is consumed by the v20 simulator
// (headless playtest, no DOM) and by the v20 Demo mode (live playtest
// driven by a recorded agent plan). Both reuse `PlaytestScene` via
// duck-typing on `scene.game.input`.
//
// Recording shape:
//   [{ frame: 0,  key: 'right', down: true  },
//    { frame: 60, key: 'right', down: false },
//    { frame: 30, key: 'space', down: true  },
//    { frame: 31, key: 'space', down: false }]
//
// Events are sorted by `frame` (the planner emits them in order). Key
// names match the v9 Input normalisation: 'left' / 'right' / 'up' /
// 'down' / 'space' / single lower-case alpha.

export class ScriptedInput {
  /**
   * @param {Array<{frame:number,key:string,down:boolean}>} recording
   */
  constructor(recording = []) {
    // Defensive copy + sort, so the caller can reuse the array.
    this._events = [...recording].sort((a, b) => a.frame - b.frame);
    this._cursor = 0; // index of the next unconsumed event
    this.held = new Set();
    this.pressed = new Set();
    this._frame = -1;
  }

  /**
   * Apply all recording events with frame <= `frame` that haven't been
   * applied yet, after clearing the just-pressed set. Call once per
   * simulator tick BEFORE `scene.update(dt)` reads input.
   *
   * Frames are expected to be monotone-increasing. Re-advancing to the
   * same frame is a no-op (idempotent within a frame).
   */
  advance(frame) {
    if (frame > this._frame) {
      // New frame → the v9 endFrame() semantics: clear the one-shot
      // pressed set.
      this.pressed.clear();
      this._frame = frame;
    }
    while (this._cursor < this._events.length && this._events[this._cursor].frame <= frame) {
      const e = this._events[this._cursor++];
      if (e.down) {
        // Mirror v9 Input._onKeyDown: pressed-edge only when not already held.
        if (!this.held.has(e.key)) this.pressed.add(e.key);
        this.held.add(e.key);
      } else {
        this.held.delete(e.key);
      }
    }
  }

  /** True for as long as the key is held down. */
  isDown(key) { return this.held.has(key); }
  /** True for exactly one frame after the key is first pressed. */
  wasPressed(key) { return this.pressed.has(key); }
  /** v9 Game loop calls this at end of frame; ScriptedInput's `advance` does it
   *  implicitly so this is a no-op (kept for shape parity). */
  endFrame() { /* no-op — advance() handles the clear at frame-start */ }
  /** v9 fork: detach listeners. ScriptedInput has none; no-op. */
  dispose() { /* no-op */ }
}
