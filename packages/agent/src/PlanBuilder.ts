import { ActionKind } from './ActionKind.ts';
import { Plan } from './Plan.ts';
import type { Cell } from './Cell.ts';
import type { Direction } from './Direction.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { PlanStats, UnreachableGoal } from './Plan.ts';
import type { Recording } from './RecordingEvent.ts';
import type { TraceEntry } from './TraceEntry.ts';

/**
 * Writes a plan step by step: the key recording, the explained trace and
 * the step counts. Both planners use it, so they press keys the same way:
 * a direction key stays held across steps that go the same way (it is
 * never pressed twice), and a jump is a one-frame tap of space.
 */
export class PlanBuilder {
  private readonly recording: Recording = [];
  private readonly trace: TraceEntry[] = [];
  private readonly stats: PlanStats = { steps: 0, jumps: 0, walks: 0, drops: 0 };
  // Frame 1, not 0: the player spawns in mid-air and needs one update to
  // land. A jump pressed on frame 0 would be ignored (it isn't grounded yet).
  private frame = 1;
  private heldDir: Direction | null = null;

  /** The frame the next step starts on. */
  get currentFrame(): number {
    return this.frame;
  }

  /** The direction key currently held down, if any. */
  get heldDirection(): Direction | null {
    return this.heldDir;
  }

  /** Hold `dir` from now on, releasing the other direction first if needed. */
  holdDirection(dir: Direction): void {
    if (this.heldDir !== dir) {
      if (this.heldDir) {
        this.recording.push({ frame: this.frame, key: this.heldDir, down: false });
      }
      this.recording.push({ frame: this.frame, key: dir, down: true });
      this.heldDir = dir;
    }
  }

  /** Tap space: down now, up on the next frame. */
  tapJump(): void {
    this.recording.push({ frame: this.frame, key: 'space', down: true });
    this.recording.push({ frame: this.frame + 1, key: 'space', down: false });
  }

  /**
   * Let go of the held direction `offset` frames into the current step —
   * but only if a direction is held and the release falls inside the
   * step's `stepCost` frames.
   */
  releaseDirectionAfter(offset: number, stepCost: number): void {
    if (this.heldDir && offset < stepCost) {
      this.recording.push({ frame: this.frame + offset, key: this.heldDir, down: false });
      this.heldDir = null;
    }
  }

  /** Finish a step: count it, explain it, and move the clock on by `cost` frames. */
  addStep(kind: ActionKind, target: Cell, why: string, cost: number, edgeId: string): void {
    this.countKind(kind);
    const startFrame = this.frame;
    this.frame += cost;
    this.trace.push({ kind, target, why, frameRange: [startFrame, this.frame], edgeId });
    this.stats.steps++;
  }

  /** Release the held direction now, so the player stops at the end of the plan. */
  releaseHeldDirection(): void {
    if (this.heldDir) {
      this.recording.push({ frame: this.frame, key: this.heldDir, down: false });
      this.heldDir = null;
    }
  }

  /** The plan written so far. */
  build(graph: LevelLayout | null, goals: string[], unreachable: UnreachableGoal[]): Plan {
    return new Plan({
      trace: this.trace,
      recording: this.recording,
      stats: this.stats,
      graph,
      goals,
      unreachable,
    });
  }

  // Walks and run-offs count as walks; both kinds of drop count as drops.
  private countKind(kind: ActionKind): void {
    if (kind === ActionKind.Jump) this.stats.jumps++;
    else if (kind === ActionKind.Walk) this.stats.walks++;
    else if (kind === ActionKind.Drop) this.stats.drops++;
    else if (kind === ActionKind.DropRelease) this.stats.drops++;
    else if (kind === ActionKind.RunOff) this.stats.walks++;
  }
}
