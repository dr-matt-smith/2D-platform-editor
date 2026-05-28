// v29 physics adapter — the agent's ONLY engine dependency.
//
// v22→v28 hardened the planning agent into a reliable solver
// (below_ground.txt solves end-to-end as of v28). v29 carves that
// solver out into packages/agent/ so alternate implementations
// (Python, MCP-callable) can plug in via this thin adapter API
// instead of importing src/play/* directly.
//
// The agent never constructs a `PlaytestScene` or `ScriptedInput`
// itself after v29 M3. It receives this object (or any object with
// the same shape) and calls `makeScene` / `makeScriptedInput`. The
// editor wires `jsAdapter` in once at the testLevel/plan boundary
// (src/main.js); tests pass it explicitly.
//
// v9 §7 invariant: this file lives in the editor (src/), NOT in the
// agent package. It is the only consumer of src/play/playtestScene.js
// + scriptedInput.js + constants.js outside main.js / renderer.js,
// keeping the vendored upstream engine cleanly separated from the
// agent.

import { PlaytestScene } from './play/playtestScene.js';
import { ScriptedInput } from './play/scriptedInput.js';
import { TILE } from './play/constants.js';

/**
 * @typedef {object} SceneHandle
 *   The agent uses only this surface of `PlaytestScene`:
 *   @property {object} game            mutable `{ input, assets }`;
 *                                       the agent swaps `game.input`
 *                                       per simulated action.
 *   @property {object} player          AABB pose + velocity + onGround.
 *   @property {Array}  coins           pickup entities (collected flag).
 *   @property {string} phase           'play' | 'won' | 'dead'.
 *   @property {number} score
 *   @property {number} simFrame        ScriptedInput frame counter.
 *   @property {number} simTime         wall-clock accumulator.
 *   @property {() => void}        enter        builds entities, phase='play'.
 *   @property {(dt:number)=>void} update       steps physics one tick.
 *   @property {(state:object)=>void} setPlayerState  forces player pose.
 */

/**
 * @typedef {object} ScriptedInputHandle
 *   @property {(frame:number)=>void} advance
 *   @property {(key:string)=>boolean} isDown
 *   @property {(key:string)=>boolean} wasPressed
 *   @property {() => void}            endFrame
 */

/**
 * @typedef {object} PhysicsAdapter
 * @property {number} TILE   engine tile size in px. Verified to match
 *                           the agent's compiled-in TILE at plan() entry.
 * @property {(parsed:object, legend:object, tileset:object|null) => SceneHandle} makeScene
 * @property {(recording:Array) => ScriptedInputHandle} makeScriptedInput
 */

/**
 * The JS physics adapter — wraps the vendored `PlaytestScene` +
 * `ScriptedInput` + `TILE`. `makeScene` returns a fully-entered
 * scene (entities built, phase='play') so callers can immediately
 * `setPlayerState` + `update`.
 *
 * @type {PhysicsAdapter}
 */
export const jsAdapter = {
  TILE,
  makeScene(parsed, legend, tileset = null) {
    // PlaytestScene reads only `game.input` (Player.update) and
    // `game.assets.play()` (coin sfx). assets.play is a no-op — the
    // simulator runs thousands of times during planning; emitting
    // sounds would be both expensive and unwanted. `game` stays a
    // mutable object so the caller can swap `game.input` per action.
    const fakeGame = { input: new ScriptedInput([]), assets: { play() {} } };
    const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
    scene.enter(); // restart(): builds entities, sets phase='play'
    return scene;
  },
  makeScriptedInput(recording = []) {
    return new ScriptedInput(recording);
  },
};
