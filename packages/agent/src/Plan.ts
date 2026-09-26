import type { Cell } from './Cell.ts';
import type { GoalKind } from './GoalKind.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { Recording } from './RecordingEvent.ts';
import type { TraceEntry } from './TraceEntry.ts';

/** Step counts for a plan. */
export interface PlanStats {
  steps: number;
  jumps: number;
  walks: number;
  drops: number;
}

/** A goal cell the planner found no path to. */
export interface UnreachableGoal extends Cell {
  kind: GoalKind;
}

/** The data a Plan is made from. */
export interface PlanData {
  trace: TraceEntry[];
  recording: Recording;
  stats: PlanStats;
  graph: LevelLayout | null;
  goals: string[];
  unreachable: UnreachableGoal[];
}

/**
 * A planner's answer for a level: the key recording to replay, the
 * explained steps behind it, and what could not be reached. A plan is
 * never null; when even the exit is out of reach its trace is empty and
 * `unreachable` says why.
 */
export class Plan implements PlanData {
  /** The explained steps, in order. */
  readonly trace: TraceEntry[];
  /** The key events that carry the plan out. */
  readonly recording: Recording;
  readonly stats: PlanStats;
  /**
   * Where the spawn, pickups and exits are. The bucket planner gives its
   * whole NavGraph (which is a LevelLayout); null only when the per-frame
   * planner found no spawn or exit.
   */
  readonly graph: LevelLayout | null;
  /** The goals in visit order as "r,c" cell keys; the last is the exit. */
  readonly goals: string[];
  readonly unreachable: UnreachableGoal[];

  constructor(data: PlanData) {
    this.trace = data.trace;
    this.recording = data.recording;
    this.stats = data.stats;
    this.graph = data.graph;
    this.goals = data.goals;
    this.unreachable = data.unreachable;
  }

  /** A plan with no steps (no spawn, no exit, or no goals). */
  static empty(graph: LevelLayout | null): Plan {
    return new Plan({
      trace: [],
      recording: [],
      stats: { steps: 0, jumps: 0, walks: 0, drops: 0 },
      graph,
      goals: [],
      unreachable: [],
    });
  }

  /** True when the plan has no steps. */
  get isEmpty(): boolean {
    return this.trace.length === 0;
  }

  /**
   * The step that was running at `frame` — the one to blame when a
   * replay fails there. A failure after the last step blames the last
   * step. Undefined only for an empty plan.
   */
  stepAtFrame(frame: number): TraceEntry | undefined {
    const entry = this.trace.find(
      (e) => e.frameRange[0] <= frame && frame < e.frameRange[1],
    );
    return entry ?? this.trace[this.trace.length - 1];
  }

  /**
   * The edge id of the longest step not already in `blocked` (the first
   * such step on a tie), or null. The longest step is usually the most
   * distinctive, so blocking it gives a genuinely different route.
   */
  longestStepNotIn(blocked: ReadonlySet<string>): string | null {
    let best: string | null = null;
    let bestCost = -1;
    for (const entry of this.trace) {
      if (blocked.has(entry.edgeId)) continue;
      const cost = entry.frameRange[1] - entry.frameRange[0];
      if (cost > bestCost) {
        bestCost = cost;
        best = entry.edgeId;
      }
    }
    return best;
  }

  /** Do both plans press the same keys at the same frames? */
  hasSameRecordingAs(other: Plan): boolean {
    if (this.recording.length !== other.recording.length) return false;
    for (let i = 0; i < this.recording.length; i++) {
      const ea = this.recording[i];
      const eb = other.recording[i];
      if (ea.frame !== eb.frame || ea.key !== eb.key || ea.down !== eb.down) return false;
    }
    return true;
  }

  /** The recording as one string — equal strings mean equal recordings. */
  recordingKey(): string {
    return this.recording.map((e) => `${e.frame}|${e.key}|${e.down ? 1 : 0}`).join(',');
  }
}
