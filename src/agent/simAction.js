// Per-action simulator — the v21 source of truth for "what does this
// action actually do?". Mints a `PlaytestScene` from the parsed level,
// forces the player to a given start state (position + velocity +
// grounded flag), and steps `scene.update(1/60)` through the action's
// recording. Returns where the player ended up, in sub-pixel precision.
//
// The graph builder (M3) runs this once per (cell, action) candidate
// during graph construction, so edges are physically valid by
// construction — no "agent thinks vs engine says" drift.
//
// Pure (no DOM, no canvas). The vendored engine is byte-untouched;
// the only consumer of `PlaytestScene.setPlayerState` is this module.

import { ScriptedInput } from '../play/scriptedInput.js';
import { PlaytestScene } from '../play/playtestScene.js';
import { TILE } from '../play/constants.js';
import { actionCost, actionToRecording } from './actions.js';

const DT = 1 / 60;

/**
 * Build a reusable simulation context. The graph builder (grid.js)
 * runs simulateActionInContext repeatedly against this ONE context
 * to avoid paying PlaytestScene + toWorld() construction costs per
 * action (28 actions × hundreds of cells = thousands of calls).
 *
 * @returns {{scene, fakeGame}}
 */
export function makeSimContext(parsed, legend, tileset = null) {
  const input = new ScriptedInput([]);
  const fakeGame = { input, assets: { play() {} } };
  const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
  scene.enter();
  return { scene, fakeGame };
}

/**
 * Simulate `action` from `startState` against an existing context.
 * Same outcome shape as `simulateAction(...)`; just faster because
 * `PlaytestScene` + `toWorld()` are reused.
 */
export function simulateActionInContext(ctx, startState, action) {
  ctx.scene.phase = 'play';
  ctx.scene.score = 0;
  for (const c of ctx.scene.coins) c.collected = false;
  // v21: recording starts at frame=1 (matches the planner's settle
  // offset). PlaytestScene's #tickScriptedInput then calls advance(0)
  // on the first update (no events fire — the player settles under
  // gravity), then advance(1) on the next update (press fires). This
  // mirrors what the live engine will see when the planner's
  // recording is replayed.
  ctx.fakeGame.input = new ScriptedInput(actionToRecording(action, 1));
  ctx.scene.setPlayerState(startState);
  // v21: reset BOTH the input-tick counter and the wall-clock
  // accumulator so successive simulations on the same context start
  // fresh — otherwise simTime keeps accumulating and the second
  // action's first update would advance through the entire recording
  // in one tick.
  ctx.scene.simFrame = 0;
  ctx.scene.simTime = 0;
  return runSimLoop(ctx.scene, ctx.fakeGame.input, action);
}

/**
 * Run one action and return the resulting state.
 *
 * @param {object} args
 * @param {object} args.parsed   level.parse() result
 * @param {object} args.legend   active tileset legend
 * @param {object|null} args.tileset
 * @param {{x:number,y:number,vx?:number,vy?:number,onGround?:boolean}} args.startState
 *        player AABB top-left + velocity at action start
 * @param {{kind:string,params:object}} args.action
 *
 * @returns {{
 *   outcome:    'ok' | 'mid-air' | 'dead' | 'won',
 *   endPos:     { x:number, y:number },     // AABB top-left
 *   endCell:    { r:number, c:number },     // cell containing AABB centre
 *   endVel:     { vx:number, vy:number },
 *   collided:   boolean,
 *   cost:       number,                       // actual frames the action took
 * }}
 */
export function simulateAction({ parsed, legend, tileset = null, startState, action }) {
  const ctx = makeSimContext(parsed, legend, tileset);
  return simulateActionInContext(ctx, startState, action);
}

/** Shared simulation loop. Called by both the single-shot and the
 *  context-reuse path. Reads input + scene from its arguments;
 *  advances scene.update(1/60) until the action's natural end.
 *
 *  - For walks: runs nominalCost+1 frames so the release event at
 *    frame=nominalCost fires and the player's vx is reset to 0
 *    before we capture endVel. Reports cost=nominalCost.
 *  - For jumps/drops: runs nominalCost+30 frames; early-exit when
 *    the player lands (wasInAir → onGround transition). Reports
 *    cost = actual landing frame.
 */
function runSimLoop(scene, input, action) {
  const nominalCost = actionCost(action);
  // v23 M6: drop_release and run_off are also "air actions" — they
  // may leave the ground mid-recording; loop should early-exit on
  // landing rather than running to the recording's nominal end.
  const isAirAction = action.kind === 'jump'
    || action.kind === 'drop'
    || action.kind === 'drop_release'
    || action.kind === 'run_off';
  // v21: the recording is offset by 1 frame (events start at f=1);
  // the loop's first iteration applies advance(0) with no events,
  // which acts as the player's settle frame. Walks need
  // (nominalCost + 1) iterations to cover the settle + the press
  // + the in-motion frames + the release frame. Jumps/drops get a
  // 30-frame buffer so the airborne arc has time to land.
  const maxFrames = isAirAction ? nominalCost + 30 : nominalCost + 1;
  let wasInAir = !scene.player.onGround;
  let collided = false;

  // The loop's `frame` is 0-indexed; "cost" is the *count* of update
  // calls = frame + 1. This matches the live engine: the planner
  // emits the action's press event at live-frame F+1 (= F=0 settle +
  // F=1 first motion frame), so the live engine takes (F+1) physics
  // updates to reach the same state simAction reaches at loop frame
  // F. Without the +1, the planner would emit a release one frame
  // too early and the player would stop short of their predicted
  // landing position.
  //
  // v21 note: `input.advance(frame)` was called explicitly here in
  // the v20.x model. v21 moved that into `PlaytestScene.update()`
  // (which calls `#tickScriptedInput` synchronously before
  // `player.update`), guaranteeing the right read-order. The loop
  // here just calls scene.update; the scene ticks the input itself.
  for (let frame = 0; frame < maxFrames; frame++) {
    const prevX = scene.player.x;
    scene.update(DT);

    if (Math.abs(scene.player.vx) > 0 && Math.abs(scene.player.x - prevX) < 0.1 && frame > 0) {
      collided = true;
    }
    if (scene.phase === 'dead') {
      return finalise(scene, frame + 1, 'dead', collided);
    }
    if (scene.phase === 'won') {
      return finalise(scene, frame + 1, 'won', collided);
    }
    if (!scene.player.onGround) {
      wasInAir = true;
    } else if (wasInAir && isAirAction) {
      return finalise(scene, frame + 1, 'ok', collided);
    }
  }
  // Walks completing normally: nominalCost is the canonical cost
  // (the extra +1 loop iteration was to process the release event;
  // the action's duration from the live engine's POV is exactly
  // nominalCost frames of motion).
  const cost = isAirAction ? maxFrames : nominalCost;
  const outcome = scene.player.onGround ? 'ok' : 'mid-air';
  return finalise(scene, cost, outcome, collided);
}

function finalise(scene, cost, outcome, collided) {
  const px = scene.player.x;
  const py = scene.player.y;
  const cx = px + scene.player.w / 2;
  const cy = py + scene.player.h / 2;
  return {
    outcome,
    endPos: { x: px, y: py },
    endCell: { r: Math.floor(cy / TILE), c: Math.floor(cx / TILE) },
    endVel: { vx: scene.player.vx, vy: scene.player.vy },
    // v25 M1: full physics state at the end of the action. The
    // shape matches PlaytestScene.setPlayerState so the next step's
    // re-simulation can begin EXACTLY where this one ended — no
    // cell-rounded drift. Existing endPos/endCell/endVel stay for
    // back-compat with v21-v24 callers.
    endState: {
      x: scene.player.x,
      y: scene.player.y,
      vx: scene.player.vx,
      vy: scene.player.vy,
      onGround: scene.player.onGround,
    },
    collided,
    cost,
  };
}
