// Playtest launcher (TDD v9 §9, refactored in v18 §4.3 to play-in-place).
//
// v18 retires the .playtest modal overlay. Instead, the playtest mounts
// directly on the editor's existing `#preview` canvas: gate the buffer,
// resize the canvas to the world dims, attach Input + Game + Playtest-
// Scene, return `{ ok, reasons, exit, restart }` so main.ts can drive
// the toolbar swap + the Esc handler. The launcher never touches DOM
// outside the canvas itself; the body.playmode class + Restart/Exit
// buttons are owned by main.ts (separation of concerns).
import { Game } from './core/game.ts';
import { Input } from './core/input.ts';
import { ScriptedInput } from './scriptedInput.ts';
import { AssetLoader } from './core/assets.ts';
import { TILE } from './constants.ts';
import { toWorld } from './adapter.ts';
import { playtestGate } from './playtestGate.ts';
import { PlaytestScene } from './playtestScene.ts';
import type { PlaytestPhase } from './playtestScene.ts';
import type { PlaytestGateResult } from './playtestGate.ts';
import type { RecordingEvent } from './scriptedInput.ts';
import type { ParsedLevel, RoleLegend } from '../level.ts';
import type { RenderTileset } from '../renderer.ts';
import type { ValidationIssue } from '../validate.ts';

export interface LaunchPlaytestOptions {
  // v20 Demo mode: a recording drives the player instead of the keyboard.
  inputSource?: readonly RecordingEvent[];
}

// The controls a launched playtest hands back to main.ts.
export interface PlaytestControls {
  exit(): void;
  restart(): void;
  onExit(cb: () => void): void;
  // The live scene's phase; 'idle' once no scene is mounted.
  getPhase(): PlaytestPhase | 'idle';
}

// A playtest that launched and is now running.
export interface PlaytestHandle extends PlaytestControls {
  ok: true;
  reasons: ValidationIssue[];
}

// Nothing launched: the gate refused (`ok` false, blocking `reasons`),
// or a playtest is already open (`ok` true, no controls).
export interface PlaytestNotLaunched extends PlaytestGateResult {
  exit?: undefined;
  restart?: undefined;
  onExit?: undefined;
  getPhase?: undefined;
}

export type LaunchPlaytestResult = PlaytestHandle | PlaytestNotLaunched;

// One playtest at a time — a second Ctrl/Cmd+Enter while play mode is
// active must not stack a second Game/Input.
let open = false;

/**
 * @param parsed  level.ts parse(src.value) — the LIVE buffer
 * @param legend  active tileset legend (for the gate's validate call)
 * @param tileset active tileset object (v14 — used by the editor renderer
 *                that PlaytestScene delegates to)
 * @param canvas  the editor's #preview canvas — mounted as the play
 *                surface; main.ts's run() repaints it on exit
 * @returns       { ok:boolean, reasons:[], exit?:fn, restart?:fn }.
 *                When !ok the caller surfaces `reasons` in the problems
 *                panel and does NOT enter play mode. When ok, the caller
 *                takes over the toolbar / Esc handling and calls
 *                exit()/restart() in response to user input.
 */
export function launchPlaytest(
  parsed: ParsedLevel,
  legend: RoleLegend,
  tileset: RenderTileset | null,
  canvas: HTMLCanvasElement,
  opts: LaunchPlaytestOptions = {},
): LaunchPlaytestResult {
  if (open) return { ok: true, reasons: [] };
  const gate = playtestGate(parsed, legend);
  if (!gate.ok) return gate;

  // Resize the editor's canvas to the play surface. The editor's run()
  // (called by main.ts on exit) will resize it back to the preview
  // TILE size when play mode ends.
  //
  // v19: when `# viewport: WxH` is set, the canvas sizes to the viewport
  // (the camera scrolls a window across the world). Pre-v19 levels
  // (viewport = null) keep sizing to the whole world (v18 behaviour).
  const vp = parsed.meta?.viewport;
  if (vp) {
    canvas.width = vp.w * TILE;
    canvas.height = vp.h * TILE;
  } else {
    const dims = toWorld(parsed, legend);
    canvas.width = dims.worldW;
    canvas.height = dims.worldH;
  }

  // v20: when `opts.inputSource` is a ScriptedInput-recording array,
  // the player is driven by the agent's plan instead of the keyboard
  // (Demo mode). The vendored Input + ScriptedInput share the same
  // shape (isDown / wasPressed / endFrame / dispose), so the engine
  // doesn't know which is in use.
  const input = Array.isArray(opts.inputSource)
    ? new ScriptedInput(opts.inputSource)
    : new Input();
  // ScriptedInput needs frame-advance ticks. We piggy-back on the Game
  // loop by wrapping update calls; simpler is to expose a frame counter
  // here and let PlaytestScene's update tick it. Cleanest: tick on
  // every requestAnimationFrame via a small bridge — set up below.
  // AssetLoader retained for `assets.play('coin', …)` — the coin pickup
  // sound is synthesised at runtime by the vendored synth() (v15 dropped
  // sprite-loading; v14 made the editor renderer the source of pixel
  // truth for the playtest canvas).
  const assets = new AssetLoader();
  // v25 M5: pre-warm the AudioContext now — we're inside a user-
  // gesture handler (the Play / Test click), which browsers
  // require for autoplay. AssetLoader.play() lazily creates the
  // context on FIRST sound; without this prime, that creation +
  // suspended→running resume happens at the same moment as the
  // first pickup, costing ~50ms of audio↔visual desync. Poking
  // assets.audio directly (rather than adding a method on the
  // vendored AssetLoader) keeps v9 §7 byte-identical-to-upstream
  // for `src/play/core/assets.ts`.
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx && !assets.audio) {
      assets.audio = new Ctx();
      if (assets.audio.state === 'suspended') assets.audio.resume();
    }
  } catch { /* AudioContext unavailable — assets.play() will no-op */ }

  const game = new Game<PlaytestScene>({ canvas, assets, input });

  let closed = false;
  let onUserExit: (() => void) | null = null;
  function exit(): void {
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
  function restart(): void {
    if (game.scene && game.scene.restart) game.scene.restart();
  }
  function onExit(cb: () => void): void {
    // Allow main.ts to register a "you've left play mode" callback (for
    // toolbar restoration + run() repaint). Fires once, from exit() above:
    // Esc and the Exit button are handled by main.ts, which calls exit().
    onUserExit = cb;
  }

  open = true;
  game.setScene(new PlaytestScene(game, parsed, legend, tileset, exit));
  // v20 used a parallel rAF here to tick the ScriptedInput's frame
  // counter; that raced with the engine's own rAF and lost the
  // first motion frame in headless / variable-fps environments.
  // v21: the ScriptedInput is ticked synchronously inside
  // `PlaytestScene.update()` (see playtestScene.ts #tickScriptedInput),
  // guaranteeing the input timeline advances before `player.update`
  // reads it. No parallel rAF needed.
  game.start();
  return { ok: true, reasons: [], exit, restart, onExit, getPhase: () => game.scene?.phase ?? 'idle' };
}
