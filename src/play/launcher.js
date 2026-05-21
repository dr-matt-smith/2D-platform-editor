// Playtest launcher (TDD v9 §9, refactored in v18 §4.3 to play-in-place).
//
// v18 retires the .playtest modal overlay. Instead, the playtest mounts
// directly on the editor's existing `#preview` canvas: gate the buffer,
// resize the canvas to the world dims, attach Input + Game + Playtest-
// Scene, return `{ ok, reasons, exit, restart }` so main.js can drive
// the toolbar swap + the Esc handler. The launcher never touches DOM
// outside the canvas itself; the body.playmode class + Restart/Exit
// buttons are owned by main.js (separation of concerns).
import { Game } from './core/game.js';
import { Input } from './core/input.js';
import { AssetLoader } from './core/assets.js';
import { toWorld } from './adapter.js';
import { playtestGate } from './playtestGate.js';
import { PlaytestScene } from './playtestScene.js';

// One playtest at a time — a second Ctrl/Cmd+Enter while play mode is
// active must not stack a second Game/Input.
let open = false;

/**
 * @param parsed  level.js parse(src.value) — the LIVE buffer
 * @param legend  active tileset legend (for the gate's validate call)
 * @param tileset active tileset object (v14 — used by the editor renderer
 *                that PlaytestScene delegates to)
 * @param canvas  the editor's #preview canvas — mounted as the play
 *                surface; main.js's run() repaints it on exit
 * @returns       { ok:boolean, reasons:[], exit?:fn, restart?:fn }.
 *                When !ok the caller surfaces `reasons` in the problems
 *                panel and does NOT enter play mode. When ok, the caller
 *                takes over the toolbar / Esc handling and calls
 *                exit()/restart() in response to user input.
 */
export function launchPlaytest(parsed, legend, tileset, canvas) {
  if (open) return { ok: true, reasons: [] };
  const gate = playtestGate(parsed, legend);
  if (!gate.ok) return gate;

  // Resize the editor's canvas to the world dims. The editor's run()
  // (called by main.js on exit) will resize it back to the preview
  // TILE size when play mode ends.
  const dims = toWorld(parsed, legend);
  canvas.width = dims.worldW;
  canvas.height = dims.worldH;

  const input = new Input();
  // AssetLoader retained for `assets.play('coin', …)` — the coin pickup
  // sound is synthesised at runtime by the vendored synth() (v15 dropped
  // sprite-loading; v14 made the editor renderer the source of pixel
  // truth for the playtest canvas).
  const assets = new AssetLoader();

  const game = new Game({ canvas, assets, input });

  let closed = false;
  let onUserExit = null;
  function exit() {
    if (closed) return;
    closed = true;
    open = false;
    game.stop();
    input.dispose();
    if (onUserExit) {
      const cb = onUserExit;
      onUserExit = null;
      cb();
    }
  }
  function restart() {
    if (game.scene && game.scene.restart) game.scene.restart();
  }
  function onExit(cb) {
    // Allow main.js to register a "you've left play mode" callback (for
    // toolbar restoration + run() repaint). Triggers on player-initiated
    // exit (PlaytestScene's R/Esc path) AND on caller's exit() above.
    onUserExit = cb;
  }

  open = true;
  game.setScene(new PlaytestScene(game, parsed, legend, tileset, exit));
  game.start();
  return { ok: true, reasons: [], exit, restart, onExit };
}
