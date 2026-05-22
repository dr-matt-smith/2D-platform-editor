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
  const input = new ScriptedInput(actionToRecording(action, 0));
  const fakeGame = { input, assets: { play() {} } };
  const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
  scene.enter();
  scene.setPlayerState(startState);

  const nominalCost = actionCost(action);
  // For jumps/drops we may need more frames than nominal to land
  // (e.g. dropping into a deep pit). Cap at nominal + 30 frames.
  const maxFrames = nominalCost + 30;

  let wasInAir = !startState.onGround;
  let collided = false;
  let cost = nominalCost;

  for (let frame = 0; frame < maxFrames; frame++) {
    input.advance(frame);
    const prevX = scene.player.x;
    scene.update(DT);

    // Wall-collision detection: AFTER update, vx is the engine's
    // applied horizontal speed for this frame; if it was nonzero but
    // x didn't change, the engine resolved a wall collision. We check
    // POST-update vx (not pre) because pre-update vx is stale from
    // the prior frame and gives false positives at dir-release frames.
    if (Math.abs(scene.player.vx) > 0 && Math.abs(scene.player.x - prevX) < 0.1 && frame > 0) {
      collided = true;
    }

    if (scene.phase === 'dead') {
      return finalise(scene, frame, 'dead', collided);
    }
    if (scene.phase === 'won') {
      return finalise(scene, frame, 'won', collided);
    }

    if (!scene.player.onGround) {
      wasInAir = true;
    } else if (wasInAir) {
      // We were in the air and now we've landed. For jump/drop, this
      // is the action's natural end.
      if (action.kind === 'jump' || action.kind === 'drop') {
        cost = frame + 1;
        return finalise(scene, cost, 'ok', collided);
      }
      wasInAir = false;
    }
  }

  // Action's nominal recording exhausted; report final state.
  const outcome = scene.player.onGround ? 'ok' : 'mid-air';
  return finalise(scene, maxFrames, outcome, collided);
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
    collided,
    cost,
  };
}
