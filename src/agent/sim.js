// Headless simulator. Runs `PlaytestScene.update(1/60)` in a tight loop
// with no canvas, no rAF, no rendering. Used by:
//
//   - The v20 planner to validate candidate plans (~50ms per 600-frame
//     simulation on a modern laptop).
//   - Unit tests that want to assert "this input sequence wins this
//     level" without touching the DOM.
//
// The vendored engine (TDD v9 §7) is byte-untouched: this module
// instantiates `PlaytestScene` with a `fakeGame = { input, assets }`
// stub (PlaytestScene reads only those two fields from `game`), then
// advances `scene.update(dt)` until `scene.phase` transitions or the
// `maxFrames` budget is exhausted.

import { ScriptedInput } from '../play/scriptedInput.js';
import { PlaytestScene } from '../play/playtestScene.js';

const DEFAULT_DT = 1 / 60;
const DEFAULT_MAX_FRAMES = 600; // 10 seconds of in-game time at 60 fps

/**
 * Run a single headless simulation.
 *
 * @param {object}   args
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
  parsed,
  legend,
  tileset = null,
  recording = [],
  dt = DEFAULT_DT,
  maxFrames = DEFAULT_MAX_FRAMES,
}) {
  const input = new ScriptedInput(recording);
  // PlaytestScene reads `game.input` (Player.update) and `game.assets.play()`
  // (coin pickup sfx). assets.play is a no-op here — the simulator runs many
  // times during planning; emitting sounds would be both expensive and
  // unwanted.
  const fakeGame = { input, assets: { play() {} } };
  const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
  scene.enter(); // calls restart(): builds entities, sets phase='play'

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
