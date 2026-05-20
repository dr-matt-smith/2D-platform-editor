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

const SPRITE_KEYS = ['player', 'coin', 'spike'];

// One playtest at a time — a second Ctrl/Cmd+Enter while the overlay is up
// must not stack a second Game/Input.
let open = false;

// Real art is the original CC BY 4.0 sprites vendored at
// /play-assets/<key>.png (TDD v9 §8). These flat-colour tiles are the
// offline / load-failure fallback so playtest still runs if a PNG is
// missing (engine degrades, never crashes).
// Vite's deploy base ('/' in dev, '/2D-platform-editor/' on GitHub Pages).
const BASE = import.meta.env?.BASE_URL ?? '/';
const SPRITE_URL = (k) => `${BASE}play-assets/${k}.png`;
// Stub palette is intentionally close to each real PNG so the pre-load
// frame doesn't flash a clashing colour: player body (green, recoloured
// by scripts/gen-player-sprite.mjs), coin (warm yellow), spike (red).
const STUB_COLOUR = { player: '#6ecd5a', coin: '#ffcc33', spike: '#e8533a' };
function stubSprite(colour) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  g.fillStyle = colour;
  g.fillRect(0, 0, 16, 16);
  return cv;
}

/**
 * @param parsed result of level.js parse(src.value) — the LIVE buffer
 * @param legend active tileset legend (for the gate's validate call)
 * @returns { ok:boolean, reasons:[] } — when !ok the overlay is NOT opened
 *          and the caller surfaces `reasons` in the problems panel.
 */
export function launchPlaytest(parsed, legend) {
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
    <div class="credit">Mechanic &amp; sprites: simple-platformer-1 @4c3b936 · CC BY 4.0</div>`;
  const canvas = overlay.querySelector('canvas');
  canvas.width = dims.worldW;
  canvas.height = dims.worldH;

  const prevFocus = document.activeElement;
  document.body.appendChild(overlay);
  open = true;

  const input = new Input();
  const assets = new AssetLoader();
  // Start on stubs so the first frame draws immediately, then swap in the
  // real PNG per sprite as it loads (loadSprite overwrites sprites[k]); a
  // failed load just keeps the stub. The coin pickup sound needs no asset —
  // it is synthesised by the vendored AssetLoader on first play() (after
  // this user-gesture launch, satisfying autoplay policy).
  for (const k of SPRITE_KEYS) {
    assets.sprites[k] = stubSprite(STUB_COLOUR[k]);
    assets.loadSprite(k, SPRITE_URL(k)).catch(() => {});
  }

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

  game.setScene(new PlaytestScene(game, parsed, legend, exit));
  game.start();
  return { ok: true, reasons: [] };
}
