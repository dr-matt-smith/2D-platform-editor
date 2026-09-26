import { SimOutcome } from './SimOutcome.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { Point } from './PlayerState.ts';
import type { Recording } from './RecordingEvent.ts';

/** The result of replaying a recording. */
export interface SimResult {
  outcome: SimOutcome;
  /** The frame the run ended on (the budget, for a timeout). */
  frame: number;
  score: number;
  /** The player's AABB top-left at the end. */
  pos: Point;
}

/** Options for Simulator.run. */
export interface SimulatorRunOptions {
  /** Passed to the adapter's makeScene; opaque to the agent. */
  tileset?: unknown;
  /** Seconds per frame (default 1/60). */
  dt?: number;
  /** Frame budget (default 600: ten seconds of game time). */
  maxFrames?: number;
}

/**
 * Replays a recording on a level, headless, and reports how it ended —
 * the check that a plan really solves the level. It steps the adapter's
 * scene in a tight loop: no canvas, no animation frames, no sound.
 */
export class Simulator {
  static readonly DEFAULT_DT = 1 / 60;
  static readonly DEFAULT_MAX_FRAMES = 600; // ten seconds at 60 fps

  constructor(private readonly adapter: PhysicsAdapter) {}

  /** Replay `recording` on a fresh scene until the player wins, dies or runs out of frames. */
  run(
    parsed: ParsedLevel,
    legend: LegendRecord | null,
    recording: Recording = [],
    options: SimulatorRunOptions = {},
  ): SimResult {
    const tileset = options.tileset ?? null;
    const dt = options.dt ?? Simulator.DEFAULT_DT;
    const maxFrames = options.maxFrames ?? Simulator.DEFAULT_MAX_FRAMES;
    const input = this.adapter.makeScriptedInput(recording);
    // The adapter's scene is already entered; swap in the recording's input.
    const scene = this.adapter.makeScene(parsed, legend, tileset);
    scene.game.input = input;

    for (let frame = 0; frame < maxFrames; frame++) {
      input.advance(frame);
      scene.update(dt);
      // An update can win or kill the player; check straight away.
      if (scene.phase === 'won') {
        return {
          outcome: SimOutcome.Won,
          frame,
          score: scene.score,
          pos: { x: scene.player.x, y: scene.player.y },
        };
      }
      if (scene.phase === 'dead') {
        return {
          outcome: SimOutcome.Dead,
          frame,
          score: scene.score,
          pos: { x: scene.player.x, y: scene.player.y },
        };
      }
    }
    return {
      outcome: SimOutcome.Timeout,
      frame: maxFrames,
      score: scene.score,
      pos: { x: scene.player.x, y: scene.player.y },
    };
  }
}
