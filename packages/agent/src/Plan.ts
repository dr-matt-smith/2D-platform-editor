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

  /**
   * The route as one string: the step ids in order. Two plans with the same
   * route key take the same moves between the same cells, even if their
   * key timings differ slightly — they would look identical on the overlay.
   */
  routeKey(): string {
    return this.trace.map((e) => e.edgeId).join('|');
  }

  /**
   * The step ids to try blocking, one at a time, to find a different
   * route: every step not already in `blocked`, longest first (the first
   * on a tie). The longest step is usually the most distinctive.
   */
  stepsToBlock(blocked: ReadonlySet<string>): string[] {
    const seen = new Set<string>();
    const steps: { id: string; cost: number; order: number }[] = [];
    this.trace.forEach((entry, order) => {
      if (blocked.has(entry.edgeId) || seen.has(entry.edgeId)) return;
      seen.add(entry.edgeId);
      steps.push({ id: entry.edgeId, cost: entry.frameRange[1] - entry.frameRange[0], order });
    });
    steps.sort((a, b) => b.cost - a.cost || a.order - b.order);
    return steps.map((s) => s.id);
  }

  /** The recording as one string — equal strings mean equal recordings. */
  recordingKey(): string {
    return this.recording.map((e) => `${e.frame}|${e.key}|${e.down ? 1 : 0}`).join(',');
  }
}
