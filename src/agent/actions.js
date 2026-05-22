// v21 action taxonomy. Replaces v20's cell-pair edge model with
// action-sequence edges: each edge IS an action the player can
// physically execute. The four kinds:
//
//   walk{dir,cells}        — hold `dir` for cells * 5 frames (one cell
//                            = 1/12 second at SPEED=240, TILE=20).
//   jump{dir,holdFrames}   — press space + hold `dir`, release `dir`
//                            after `holdFrames` frames. Releasing
//                            mid-arc caps horizontal travel — the
//                            mechanic that lets the player land precisely
//                            on a small platform instead of overshooting
//                            it (the v21 "release-direction-mid-jump"
//                            unlock).
//   drop{dir}              — hold `dir` and walk off the ledge; fall
//                            until landing.
//   wait{frames}           — release everything for `frames` frames
//                            (used by replans to let a fall settle).
//
// Pure: no DOM, no engine, no rendering. Consumers (simAction.js,
// grid.js, planner.js, agentDialog.js) read these structs.

import { JUMP_FORCE, GRAVITY } from '../play/constants.js';

/** Frames the player covers one cell of walking at SPEED=240, TILE=20.
 *  20 / (240/60) = 5 frames per cell. */
export const WALK_FRAMES_PER_CELL = 5;

/** Full jump-arc duration (2 * JUMP_FORCE / GRAVITY * 60), in frames.
 *  Used as the canonical jump cost; the actual landing may be sooner
 *  (higher platform) or later (lower platform) — sim resolves. */
export const JUMP_ARC_FRAMES = Math.round((2 * JUMP_FORCE) / GRAVITY * 60);

/** Release-frame choices for the jump action — 12 evenly-spaced values
 *  spanning the arc. Picked to give cell-precision landings without
 *  blowing up the per-cell edge count. */
export const RELEASE_FRAMES = [2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42];

/** Buffer used for the drop action's nominal recording length. The
 *  simAction reads its actual fall duration; this is just the "hold
 *  direction for at most this long" bound. */
const DROP_HOLD_FRAMES_BUDGET = 60;

/* v23 M6: action-graph completeness. The v21 set (walk, jump with 12
   release-frames, drop) covers the common cases but cannot enumerate:
     - the "drop and RELEASE direction mid-fall" trajectory that lets
       the player descend more vertically (analog of release-mid-jump,
       but for drops)
     - the "walk N cells THEN fall off" trajectory where the prior walk
       builds horizontal carry into the fall
   These add 4 + 5 + 2 + 2 = ~14 new edges per platform-edge cell. */

/** v23 M6: explicit release frames for drop_release — analog of
 *  RELEASE_FRAMES for jumps. Each value is the frame at which the held
 *  direction key is RELEASED (vx → 0). Pre-release: vx held;
 *  post-release: pure vertical fall. */
export const DROP_RELEASE_FRAMES = [8, 16, 24, 32];

/** v23 M6: walk-distance variants for run_off — how many cells to
 *  walk before letting gravity take over. The walk and the fall are
 *  one continuous held-direction recording; the simulator decides
 *  when "walking off the edge" actually fires based on cell geometry.
 *  Lengths 2..6 give the agent 5 distinct carry distances. */
export const RUN_OFF_WALK_CELLS = [2, 3, 4, 5, 6];

/**
 * Enumerate all candidate actions from a (grounded) cell. Returns a
 * fresh array of `{ kind, params }` objects. Cell shape: `{r, c}`.
 *
 * Does NOT filter for physical achievability — that's `simAction`'s
 * job. The graph builder runs `simulateAction(...)` for each
 * candidate and keeps only the ones that land cleanly on a grounded
 * cell with no fatal collision.
 *
 * Per cell: 2 walks + 24 jumps (12 release-frames × 2 dirs) + 2
 * drops = 28 candidates. v23 M6 adds 8 drop_release variants
 * (4 release-frames × 2 dirs) + 10 run_off variants (5 walk-cells
 * × 2 dirs) = 18 new candidates → 46 total per cell. Single-cell
 * walks; the planner's A* chains them for longer traverses.
 */
export function enumerateActions() {
  const actions = [];
  for (const dir of ['left', 'right']) {
    actions.push({ kind: 'walk', params: { dir, cells: 1 } });
    for (const holdFrames of RELEASE_FRAMES) {
      actions.push({ kind: 'jump', params: { dir, holdFrames } });
    }
    actions.push({ kind: 'drop', params: { dir } });
    // v23 M6: drop with EXPLICIT mid-fall direction release. The held
    // direction is released at `releaseFrame`, so vx drops to 0 and
    // the rest of the fall is vertical. Distinct landings vs drop's
    // held-throughout behaviour, especially across narrow gaps.
    for (const releaseFrame of DROP_RELEASE_FRAMES) {
      actions.push({ kind: 'drop_release', params: { dir, releaseFrame } });
    }
    // v23 M6: run_off — walk N cells (building vx to walk-speed), then
    // continue holding direction through the resulting fall. Encodes
    // "walk along this platform and step off the end" as an explicit
    // edge. Falls back to a long-walk in the absence of a ledge.
    for (const walkCells of RUN_OFF_WALK_CELLS) {
      actions.push({ kind: 'run_off', params: { dir, walkCells } });
    }
  }
  return actions;
}

/**
 * The cost (in frames) of executing the action with held inputs.
 * For drops, the cost depends on landing distance and is computed
 * by `simAction`; the value returned here is the maximum-hold
 * window, used to size the recording.
 */
export function actionCost(action) {
  const { kind, params } = action;
  if (kind === 'walk') return params.cells * WALK_FRAMES_PER_CELL;
  if (kind === 'jump') return JUMP_ARC_FRAMES;
  if (kind === 'drop') return DROP_HOLD_FRAMES_BUDGET;
  // v23 M6: drop_release holds direction for releaseFrame frames,
  // then releases; budget for the post-release fall is the same as
  // drop's standard buffer.
  if (kind === 'drop_release') return DROP_HOLD_FRAMES_BUDGET;
  // v23 M6: run_off — walkCells*5 frames of walking + a fall buffer
  // (same magnitude as drop). The simulator decides actual cost.
  if (kind === 'run_off') {
    return params.walkCells * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET;
  }
  if (kind === 'wait') return params.frames;
  throw new Error(`unknown action kind: ${kind}`);
}

/**
 * Convert an action to a frame-indexed input-events array for
 * `ScriptedInput`. `frameStart` is the absolute frame the action
 * begins; events fire relative to it.
 *
 * - walk: hold `dir` at start, release at `start + cells*5`.
 * - jump: hold `dir` at start AND press space at start; release space
 *         at start+1 (single-frame tap); release `dir` at
 *         `start + holdFrames` (the release-mid-arc moment).
 * - drop: hold `dir` at start, release at `start + DROP_HOLD_BUDGET`.
 * - wait: no events.
 */
export function actionToRecording(action, frameStart = 0) {
  const events = [];
  const { kind, params } = action;
  if (kind === 'walk') {
    const end = frameStart + params.cells * WALK_FRAMES_PER_CELL;
    events.push({ frame: frameStart, key: params.dir, down: true });
    events.push({ frame: end, key: params.dir, down: false });
  } else if (kind === 'jump') {
    events.push({ frame: frameStart, key: params.dir, down: true });
    events.push({ frame: frameStart, key: 'space', down: true });
    events.push({ frame: frameStart + 1, key: 'space', down: false });
    events.push({ frame: frameStart + params.holdFrames, key: params.dir, down: false });
  } else if (kind === 'drop') {
    events.push({ frame: frameStart, key: params.dir, down: true });
    events.push({ frame: frameStart + DROP_HOLD_FRAMES_BUDGET, key: params.dir, down: false });
  } else if (kind === 'drop_release') {
    // v23 M6: hold dir from start; RELEASE at releaseFrame so vx
    // drops to 0 mid-fall, yielding a more-vertical descent.
    events.push({ frame: frameStart, key: params.dir, down: true });
    events.push({ frame: frameStart + params.releaseFrame, key: params.dir, down: false });
  } else if (kind === 'run_off') {
    // v23 M6: hold dir throughout — walk along ground then carry into
    // the fall. The "off-ledge" transition is determined by geometry,
    // not the recording.
    const total = params.walkCells * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET;
    events.push({ frame: frameStart, key: params.dir, down: true });
    events.push({ frame: frameStart + total, key: params.dir, down: false });
  } else if (kind === 'wait') {
    // No key events; just elapsed time.
  } else {
    throw new Error(`unknown action kind: ${kind}`);
  }
  return events;
}

/**
 * Format the action's `why:` string for the trace renderer.
 *
 *   walk_right_1 toward "pickup #2 at (5,8)"  →  "walk right 1 cell toward pickup #2 at (5,8)"
 *   jump_left @ release 26 toward "exit"      →  "jump left (release at frame 26) toward exit"
 *   drop_right toward "exit"                  →  "drop off ledge right toward exit"
 */
export function actionToWhy(action, subgoalName = '') {
  const { kind, params } = action;
  const sub = subgoalName ? ` toward ${subgoalName}` : '';
  if (kind === 'walk') {
    const noun = params.cells === 1 ? 'cell' : 'cells';
    return `walk ${params.dir} ${params.cells} ${noun}${sub}`;
  }
  if (kind === 'jump') {
    return `jump ${params.dir} (release at frame ${params.holdFrames})${sub}`;
  }
  if (kind === 'drop') return `drop off ledge ${params.dir}${sub}`;
  if (kind === 'drop_release') {
    return `drop ${params.dir} (release at frame ${params.releaseFrame})${sub}`;
  }
  if (kind === 'run_off') {
    const noun = params.walkCells === 1 ? 'cell' : 'cells';
    return `walk ${params.dir} ${params.walkCells} ${noun} then carry into fall${sub}`;
  }
  if (kind === 'wait') return `wait ${params.frames} frame${params.frames === 1 ? '' : 's'}`;
  return `${kind}${sub}`;
}
