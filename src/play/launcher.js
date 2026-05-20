// Playtest launcher (TDD v9 §9). Gate the current buffer, and if it
// passes, open a modal overlay running the vendored engine on it. This is
// the only DOM-touching v9 module besides the main.js hook; it never feeds
// back into the editor's parse/validate/render pipeline.
import { Game } from './core/game.js';
import { Input } from './core/input.js';
import { AssetLoader } from './core/assets.js';
import { toWorld } from './adapter.js';
import { playtestGate } from './playtestGate.js';
import { PlaytestScene } from './playtestScene.js';

// One playtest at a time — a second Ctrl/Cmd+Enter while the overlay is up
// must not stack a second Game/Input.
let open = false;

/**
 * @param parsed result of level.js parse(src.value) — the LIVE buffer
 * @param legend active tileset legend (for the gate's validate call)
 * @returns { ok:boolean, reasons:[] } — when !ok the overlay is NOT opened
 *          and the caller surfaces `reasons` in the problems panel.
 */
export function launchPlaytest(parsed, legend, tileset) {
  if (open) return { ok: true, reasons: [] };
  const gate = playtestGate(parsed, legend);
  if (!gate.ok) return gate;

  const dims = toWorld(parsed, legend); // for canvas intrinsic size only

  const overlay = document.createElement('div');
  overlay.className = 'playtest';
  overlay.innerHTML = `
    <div class="playtest-bar">
      <button data-act="restart">Restart (R)</button>
      <button data-act="exit">Exit (Esc)</button>
      <span class="hint">Arrows / Space: move &amp; jump</span>
    </div>
    <canvas></canvas>
    <div class="credit">Mechanic: simple-platformer-1 @4c3b936 · CC BY 4.0</div>`;
  const canvas = overlay.querySelector('canvas');
  canvas.width = dims.worldW;
  canvas.height = dims.worldH;

  const prevFocus = document.activeElement;
  document.body.appendChild(overlay);
  open = true;

  const input = new Input();
  // AssetLoader is retained for `assets.play('coin', …)` — the coin
  // pickup sound is synthesised at runtime by the vendored synth()
  // (no audio file vendored). v15 dropped the legacy sprite-loading
  // since v14 makes the editor renderer the single source of pixel
  // truth for the playtest canvas (no `assets.sprite("…")` calls).
  const assets = new AssetLoader();

  const game = new Game({ canvas, assets, input });

  let closed = false;
  function exit() {
    if (closed) return;
    closed = true;
    open = false;
    game.stop();
    input.dispose();
    window.removeEventListener('keydown', onEsc, true);
    overlay.remove();
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }

  // Input doesn't normalise Escape, so the launcher owns it. Capture phase
  // so it wins regardless of focus inside the overlay.
  function onEsc(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      exit();
    }
  }
  window.addEventListener('keydown', onEsc, true);

  overlay.querySelector('[data-act="exit"]').addEventListener('click', exit);
  overlay
    .querySelector('[data-act="restart"]')
    .addEventListener('click', () => game.scene && game.scene.restart());

  game.setScene(new PlaytestScene(game, parsed, legend, tileset, exit));
  game.start();
  return { ok: true, reasons: [] };
}
