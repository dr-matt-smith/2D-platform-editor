import { TILE } from './constants.ts';
import { ActionOutcome } from './ActionOutcome.ts';
import type { Action } from './Action.ts';
import type { ActionResult, SimulateActionOptions } from './ActionResult.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { PlayerState, Point } from './PlayerState.ts';
import type { SceneGame, SceneHandle } from './SceneHandle.ts';
import type { ScriptedInputHandle } from './InputSource.ts';

/**
 * Answers "if the player is in exactly this state and performs this
 * action, where do they end up?" by running the real engine through the
 * adapter. It is the planners' source of truth: every edge they search
 * over comes from here.
 *
 * Building a scene is the expensive part, so one ActionSimulator keeps
 * one scene and resets it before each simulation. A planner creates one
 * per level and runs thousands of simulations on it.
 */
export class ActionSimulator {
  private static readonly DT = 1 / 60;

  private constructor(
    private readonly adapter: PhysicsAdapter,
    private readonly scene: SceneHandle,
    // The scene's game object, captured once; each simulation swaps its input.
    private readonly game: SceneGame,
  ) {}

  /** A simulator over a fresh scene of `parsed` (the adapter builds it). */
  static create(
    adapter: PhysicsAdapter,
    parsed: ParsedLevel,
    legend: LegendRecord | null,
    tileset: unknown = null,
  ): ActionSimulator {
    const scene = adapter.makeScene(parsed, legend, tileset);
    return new ActionSimulator(adapter, scene, scene.game);
  }

  /** Simulate `action` starting from exactly `startState`. */
  simulate(startState: PlayerState, action: Action, options: SimulateActionOptions = {}): ActionResult {
    this.scene.phase = 'play';
    this.scene.score = 0;
    for (const c of this.scene.coins) c.collected = false;
    // The recording starts at frame 1, as a plan's does: the first update
    // applies frame 0 (nothing happens, the player settles) and the key
    // presses land on the next — exactly what the live engine will see
    // when the plan is replayed.
    const input = this.adapter.makeScriptedInput(action.toRecording(1));
    this.game.input = input;
    this.scene.setPlayerState(startState);
    // Reset the input frame counter and the clock, or the second
    // simulation's first update would run through its whole recording.
    this.scene.simFrame = 0;
    this.scene.simTime = 0;
    return this.run(input, action, options);
  }

  // Step the scene through the action. A walk runs one frame past its
  // nominal cost, so the release fires and the speed is zero at the end;
  // an action that leaves the ground gets 30 extra frames and stops as
  // soon as the player lands.
  private run(input: ScriptedInputHandle, action: Action, options: SimulateActionOptions): ActionResult {
    const scene = this.scene;
    const nominalCost = action.nominalCost;
    const collectTrajectory = options.collectTrajectory === true;
    const trajectory: Point[] | null = collectTrajectory ? [] : null;
    const isAirAction = action.leavesGround;
    const maxFrames = isAirAction ? nominalCost + 30 : nominalCost + 1;
    let wasInAir = !scene.player.onGround;
    let collided = false;

    // The loop's `frame` counts from 0, so the cost (the number of
    // updates) is frame + 1 — the live engine needs that many updates to
    // reach the same state. Advancing the input explicitly before each
    // update matches the Simulator's replay loop; relying on the scene's
    // own clock instead drifts by a frame (1/60 doesn't add up exactly).
    // Re-advancing to the same frame is a no-op.
    for (let frame = 0; frame < maxFrames; frame++) {
      input.advance(frame);
      const prevX = scene.player.x;
      scene.update(ActionSimulator.DT);

      if (trajectory) trajectory.push({ x: scene.player.x, y: scene.player.y });

      if (Math.abs(scene.player.vx) > 0 && Math.abs(scene.player.x - prevX) < 0.1 && frame > 0) {
        collided = true;
      }
      if (scene.phase === 'dead') {
        return this.result(frame + 1, ActionOutcome.Dead, collided, trajectory);
      }
      if (scene.phase === 'won') {
        return this.result(frame + 1, ActionOutcome.Won, collided, trajectory);
      }
      if (!scene.player.onGround) {
        wasInAir = true;
      } else if (wasInAir && isAirAction) {
        return this.result(frame + 1, ActionOutcome.Ok, collided, trajectory);
      }
    }
    // A walk that ran its course costs exactly its nominal frames (the
    // extra update only processed the release).
    const cost = isAirAction ? maxFrames : nominalCost;
    const outcome = scene.player.onGround ? ActionOutcome.Ok : ActionOutcome.MidAir;
    return this.result(cost, outcome, collided, trajectory);
  }

  private result(
    cost: number,
    outcome: ActionOutcome,
    collided: boolean,
    trajectory: Point[] | null = null,
  ): ActionResult {
    const player = this.scene.player;
    const px = player.x;
    const py = player.y;
    const cx = px + player.w / 2;
    const cy = py + player.h / 2;
    return {
      outcome,
      endPos: { x: px, y: py },
      endCell: { r: Math.floor(cy / TILE), c: Math.floor(cx / TILE) },
      endVel: { vx: player.vx, vy: player.vy },
      // The full state, so the next simulation can start exactly here.
      endState: {
        x: player.x,
        y: player.y,
        vx: player.vx,
        vy: player.vy,
        onGround: player.onGround,
      },
      trajectory,
      collided,
      cost,
    };
  }
}
