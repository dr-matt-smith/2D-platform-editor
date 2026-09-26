// Headless simulator. Runs `PlaytestScene.update(1/60)` in a tight loop
// with no canvas, no rAF, no rendering. Used by:
//
//   - The v20 planner to validate candidate plans (~50ms per 600-frame
//     simulation on a modern laptop).
//   - Unit tests that want to assert "this input sequence wins this
//     level" without touching the DOM.
//
// The vendored engine (TDD v9 §7) is byte-untouched. v29 M2: this
// module no longer imports `PlaytestScene` / `ScriptedInput` — it
// mints both through the injected physics adapter. The adapter's
// `makeScene` returns an already-entered scene whose `game` is a
// mutable `{ input, assets }`; we swap in the recording's input, then
// advance `scene.update(dt)` until `scene.phase` transitions or the
// `maxFrames` budget is exhausted.

import type { Recording } from './actions.ts';

// ---- Physics-adapter contract ------------------------------------------
//
// The agent's ONLY engine dependency (see README.md). The parsed level
// and legend are the editor's; these interfaces name just the fields
// the agent reads, so the editor's richer types are assignable.

/** `# pickup-required:` — 'all' (default) or a count (0 = none). */
export type PickupRequired = 'all' | number;

/** The subset of the editor's `level.parse()` result the agent reads. */
export interface ParsedLevel {
  grid: readonly string[];
  meta: {
    width: number;
    pickupRequired?: PickupRequired;
  };
}

/** One glyph's legend entry; the agent reads only `role`. */
export interface LegendEntry {
  role?: string | null;
}

/** Char-keyed glyph legend (the active tileset's). */
export type Legend = { readonly [glyph: string]: LegendEntry | undefined };

/** Exact continuous-physics player state (AABB top-left + velocity). */
export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

/** The scene's live player: state plus AABB size. */
export interface PlayerBody extends PlayerState {
  w: number;
  h: number;
}

export type ScenePhase = 'play' | 'won' | 'dead';

/** Any input source a scene reads (keyboard or scripted). */
export interface InputSource {
  isDown(key: string): boolean;
  wasPressed(key: string): boolean;
  endFrame(): void;
  /** Present on scripted sources; applies events up to `frame`. */
  advance?(frame: number): void;
}

/** A scripted input source over a recording. */
export interface ScriptedInputHandle extends InputSource {
  advance(frame: number): void;
}

/** Mutable game object; the agent swaps `input` per simulated action. */
export interface SceneGame {
  input: InputSource;
}

/** The surface of the engine's playtest scene the agent uses. */
export interface SceneHandle {
  game: SceneGame;
  player: PlayerBody;
  coins: Array<{ collected: boolean }>;
  phase: ScenePhase;
  score: number;
  /** ScriptedInput frame counter. */
  simFrame: number;
  /** Wall-clock accumulator. */
  simTime: number;
  /** Builds entities, phase='play'. */
  enter(): void;
  /** Steps physics one tick. */
  update(dt: number): void;
  /** Forces the player pose. */
  setPlayerState(state: PlayerState): void;
}

/** The engine binding every simulating entry point takes. */
export interface PhysicsAdapter {
  /** Engine tile size in px; must equal the agent's TILE (assertAdapter). */
  readonly TILE: number;
  /** A fresh, already-entered scene. `tileset` is opaque to the agent. */
  makeScene(parsed: ParsedLevel, legend: Legend | null, tileset: unknown): SceneHandle;
  makeScriptedInput(recording: Recording): ScriptedInputHandle;
}

export interface SimulateArgs {
  adapter: PhysicsAdapter;
  parsed: ParsedLevel;
  legend: Legend | null;
  tileset?: unknown;
  recording?: Recording;
  dt?: number;
  maxFrames?: number;
}

/** Result of a headless `simulate()` run. */
export interface SimResult {
  outcome: 'won' | 'dead' | 'timeout';
  frame: number;
  score: number;
  pos: { x: number; y: number };
}

const DEFAULT_DT = 1 / 60;
const DEFAULT_MAX_FRAMES = 600; // 10 seconds of in-game time at 60 fps

/**
 * Run a single headless simulation.
 *
 * @param {object}   args
 * @param {object}   args.adapter    physics adapter (v29 M2)
 * @param {object}   args.parsed     result of `level.parse()`
 * @param {object}   args.legend     active tileset legend
 * @param {object|null} args.tileset active tileset object (or null for offline)
 * @param {Array}    [args.recording=[]] ScriptedInput recording
 * @param {number}   [args.dt=1/60]       simulator time step (seconds)
 * @param {number}   [args.maxFrames=600] frame budget (= 10s at 1/60)
 * @returns {{
 *   outcome: 'won'|'dead'|'timeout',
 *   frame:   number,
 *   score:   number,
 *   pos:     {x:number,y:number},
 * }}
 */
export function simulate({
  adapter,
  parsed,
  legend,
  tileset = null,
  recording = [],
  dt = DEFAULT_DT,
  maxFrames = DEFAULT_MAX_FRAMES,
}: SimulateArgs): SimResult {
  const input = adapter.makeScriptedInput(recording);
  // The adapter's makeScene returns an already-entered scene
  // (restart() built the entities, phase='play') whose `game` is a
  // mutable `{ input, assets }`. assets.play is a no-op — the
  // simulator runs many times during planning; emitting sounds would
  // be both expensive and unwanted. Swap in the recording's input.
  const scene = adapter.makeScene(parsed, legend, tileset);
  scene.game.input = input;

  for (let frame = 0; frame < maxFrames; frame++) {
    input.advance(frame);
    scene.update(dt);
    // PlaytestScene.update may transition phase to 'won' or 'dead' the
    // same tick it's read. Check immediately and bail.
    if (scene.phase === 'won') {
      return {
        outcome: 'won',
        frame,
        score: scene.score,
        pos: { x: scene.player.x, y: scene.player.y },
      };
    }
    if (scene.phase === 'dead') {
      return {
        outcome: 'dead',
        frame,
        score: scene.score,
        pos: { x: scene.player.x, y: scene.player.y },
      };
    }
  }
  return {
    outcome: 'timeout',
    frame: maxFrames,
    score: scene.score,
    pos: { x: scene.player.x, y: scene.player.y },
  };
}
