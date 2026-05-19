/**
 * Top-level orchestrator. Owns the canvas, its 2D context, the asset
 * loader, the input system, and the currently-active scene. Runs the
 * requestAnimationFrame loop and routes update/draw calls to the scene.
 *
 * Constructed once per playtest session by the launcher.
 *
 * VENDORED from simple-platformer-1@4c3b936. Forks (TDD v9 §7):
 *  - `stop()` + a `running` flag so the editor can tear the loop down on
 *    playtest exit (upstream's rAF loop was unbounded).
 *  - clears the canvas at its actual size, not the fixed CANVAS_W/H, so an
 *    arbitrary-size designer level repaints fully (the now-unused
 *    CANVAS_W/H import is consequently dropped).
 */
export class Game {
  /**
   * @param {object}        deps
   * @param {HTMLCanvasElement} deps.canvas - the play <canvas> element
   * @param {AssetLoader}   deps.assets    - preloaded sprites
   * @param {Input}         deps.input     - keyboard input instance
   */
  constructor({ canvas, assets, input }) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.input  = input;
    this.scene  = null;
    this.running = false; // v9 fork: gates the rAF loop (see stop())
  }

  /**
   * Swap the active scene. Calls `exit()` on the outgoing scene and
   * `enter()` on the incoming one. Safe to call from inside a scene's
   * own update — the loop reads `this.scene` afresh each frame.
   */
  setScene(sceneInstance) {
    if (this.scene) this.scene.exit();
    this.scene = sceneInstance;
    this.scene.enter();
  }

  /**
   * Begin the requestAnimationFrame loop. `dt` is clamped to 1/30s so
   * physics doesn't tunnel after a tab-blur stall.
   */
  start() {
    this.running = true; // v9 fork
    let last = performance.now();
    const tick = (now) => {
      if (!this.running) return; // v9 fork: stop() ends the loop
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      this.scene.update(dt);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // v9 fork
      this.scene.draw(this.ctx);
      this.input.endFrame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** v9 fork: stop the rAF loop (editor playtest teardown, TDD v9 §7). */
  stop() { this.running = false; }
}
