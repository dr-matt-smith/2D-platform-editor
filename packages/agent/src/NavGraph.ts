import { SPEED, TILE } from './constants.ts';
import { ActionCatalog } from './ActionCatalog.ts';
import { ActionOutcome } from './ActionOutcome.ts';
import { ActionSimulator } from './ActionSimulator.ts';
import { CellKey } from './CellKey.ts';
import { LevelGrid } from './LevelGrid.ts';
import { StateKey } from './StateKey.ts';
import { XOffsetBucket } from './XOffsetBucket.ts';
import type { ActionKind } from './ActionKind.ts';
import type { Cell } from './Cell.ts';
import type { Direction } from './Direction.ts';
import type { LegendRecord } from './LegendRecord.ts';
import type { LevelLayout } from './LevelLayout.ts';
import type { MoveAction } from './MoveAction.ts';
import type { ParsedLevel } from './ParsedLevel.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { PlayerState, Point, Velocity } from './PlayerState.ts';
import type { Recording } from './RecordingEvent.ts';

/** A NavGraph node: one (cell, speed bucket, x-offset bucket) state. */
export interface NavNode extends Cell {
  vxBucket: number;
  xOffsetBucket: XOffsetBucket;
  /** Is there terrain under the cell? */
  supported: boolean;
}

/** A simulated action from one node to another. */
export interface NavEdge {
  /** Destination StateKey text. */
  to: string;
  kind: ActionKind;
  cost: number;
  dir: Direction;
  action: MoveAction;
  recording: Recording;
  endPos: Point;
  endVel: Velocity;
  /** The exact state the action ended in. */
  endState: PlayerState;
  isWinEdge: boolean;
  /** Set on precision-landing edges (see NavGraph.addActionEdges). */
  precision?: boolean;
}

/** One step of a NavGraph path: the edge taken and the StateKey it left from. */
export interface NavPathStep {
  from: string;
  edge: NavEdge;
}

/**
 * The bucket planner's search graph. Each walkable cell becomes nine
 * nodes (3 speed buckets x 3 x-offset buckets), keyed by StateKey text;
 * each edge is a candidate action that was simulated from the node and
 * landed cleanly. Edges are therefore physically valid by construction:
 * the planner picks actions, and physics says where they end up.
 */
export class NavGraph implements LevelLayout {
  private constructor(
    /** StateKey text → node. */
    readonly nodes: Map<string, NavNode>,
    /** StateKey text → the edges leaving that node. */
    readonly edges: Map<string, NavEdge[]>,
    readonly start: Cell | null,
    readonly pickupCells: Cell[],
    readonly exitCells: Cell[],
    readonly width: number,
    readonly height: number,
  ) {}

  /**
   * Build the graph for a level: create the nodes, then simulate all 46
   * candidate actions from every grounded node through `adapter`. One
   * scene is reused for every simulation.
   */
  static build(
    adapter: PhysicsAdapter,
    parsed: ParsedLevel,
    legend: LegendRecord | null = null,
    tileset: unknown = null,
  ): NavGraph {
    const grid = new LevelGrid(parsed, legend);
    const nodes = new Map<string, NavNode>();
    const edges = new Map<string, NavEdge[]>();

    // Each walkable cell becomes nine nodes. The speed bucket alone wasn't
    // enough: two states with the same speed but a different sub-cell x
    // can land on different cells after a chained jump.
    for (let r = 0; r < grid.height; r++) {
      for (let c = 0; c < parsed.grid[r].length; c++) {
        if (!grid.isWalkable(r, c)) continue;
        for (const vxBucket of StateKey.VX_BUCKETS) {
          for (const xOffsetBucket of StateKey.X_OFFSET_BUCKETS) {
            const k = StateKey.of(r, c, vxBucket, xOffsetBucket).toString();
            nodes.set(k, {
              r, c, vxBucket, xOffsetBucket,
              supported: grid.isGrounded(r, c),
            });
          }
        }
      }
    }
    const { start, pickupCells, exitCells, width, height } = grid.findLayout();

    // A scene needs a player spawn. Test levels without one still get
    // nodes (useful for inspecting cells), just no edges.
    const simulator = grid.hasPlayerGlyph()
      ? ActionSimulator.create(adapter, parsed, legend, tileset)
      : null;

    // Pickups and exits are precision-landing targets: an edge whose arc
    // passes through one also gets an edge to it (see addActionEdges).
    const precisionTargets = [...pickupCells, ...exitCells];

    for (const [k, n] of nodes) {
      edges.set(k, []);
      if (!grid.isGrounded(n.r, n.c)) continue;
      if (!simulator) continue;
      // Only left-third nodes get edges; the centre and right nodes exist
      // but stay empty. Starting from them would need exact sub-pixel
      // states, which is what the per-frame planner does instead.
      if (n.xOffsetBucket !== XOffsetBucket.Left) continue;
      NavGraph.addActionEdges(simulator, grid, n, edges.get(k)!, exitCells, precisionTargets);
    }

    return new NavGraph(nodes, edges, start, pickupCells, exitCells, width, height);
  }

  /** Does the graph have a node with this StateKey text? */
  hasNode(key: string): boolean {
    return this.nodes.has(key);
  }

  /** The edges leaving a node (empty for an unknown key). */
  edgesFrom(key: string): readonly NavEdge[] {
    return this.edges.get(key) ?? [];
  }

  /**
   * A* from the StateKey `from` to any node in the cell `to` ("r,c") —
   * whichever speed and offset buckets are cheapest to arrive in.
   * Edges whose id ("from>to:kind") is in `blocked` are skipped. Returns
   * the path (empty if `from` is already in the cell), or null if there
   * is none.
   */
  findPath(from: string, to: string, blocked: ReadonlySet<string> = new Set()): NavPathStep[] | null {
    if (!this.nodes.has(from)) return null;
    // Any StateKey whose text starts with the cell key matches.
    const goalCellPrefix = to + ',';
    const matchesGoal = (k: string) => k === to || k.startsWith(goalCellPrefix);
    if (matchesGoal(from)) return [];

    const { r: fr, c: fc } = CellKey.parse(from);
    const { r: tr, c: tc } = CellKey.parse(to);

    const open = new Set([from]);
    const cameFrom = new Map<string, NavPathStep>();
    const gScore = new Map([[from, 0]]);
    const fScore = new Map([[from, NavGraph.heuristic(fr, fc, tr, tc)]]);

    while (open.size > 0) {
      const current = NavGraph.lowestF(open, fScore)!;
      if (matchesGoal(current)) {
        const path: NavPathStep[] = [];
        let node = current;
        while (cameFrom.has(node)) {
          const { from: prev, edge } = cameFrom.get(node)!;
          path.unshift({ from: prev, edge });
          node = prev;
        }
        return path;
      }
      open.delete(current);
      const edges = this.edges.get(current) ?? [];
      for (const edge of edges) {
        // The edge id names direction and kind, so a replan can block one
        // specific edge.
        const edgeId = `${current}>${edge.to}:${edge.kind}`;
        if (blocked.has(edgeId)) continue;
        const tentative = (gScore.get(current) ?? Infinity) + edge.cost;
        if (tentative < (gScore.get(edge.to) ?? Infinity)) {
          cameFrom.set(edge.to, { from: current, edge });
          gScore.set(edge.to, tentative);
          const { r: er, c: ec } = CellKey.parse(edge.to);
          fScore.set(edge.to, tentative + NavGraph.heuristic(er, ec, tr, tc));
          open.add(edge.to);
        }
      }
    }
    return null;
  }

  /** Total frame cost of a path. */
  static pathCost(path: readonly NavPathStep[]): number {
    return path.reduce((s, step) => s + step.edge.cost, 0);
  }

  // Manhattan cell distance times the one-cell walk cost: admissible,
  // since no action covers a cell faster than walking.
  private static heuristic(fromR: number, fromC: number, toR: number, toC: number): number {
    return (Math.abs(fromR - toR) + Math.abs(fromC - toC)) * 5;
  }

  private static lowestF(open: Set<string>, fScore: Map<string, number>): string | null {
    let best: string | null = null;
    let bestF = Infinity;
    for (const k of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        best = k;
      }
    }
    return best;
  }

  // Simulate every candidate action from `node` and keep the ones that
  // end cleanly, as edges into `edgesArr`.
  private static addActionEdges(
    simulator: ActionSimulator,
    grid: LevelGrid,
    node: NavNode,
    edgesArr: NavEdge[],
    exitCells: Cell[],
    precisionTargets: Cell[] = [],
  ): void {
    // Start from the middle of the node's x-offset bucket, carrying the
    // node's speed bucket as a velocity.
    const startVx = node.vxBucket * SPEED;
    const startState = {
      x: StateKey.bucketCentreX(node.c, node.xOffsetBucket),
      y: node.r * TILE,
      vx: startVx,
      vy: 0,
      onGround: true,
    };

    // Only record trajectories when there are targets to check them against.
    const wantsTrajectory = precisionTargets.length > 0;

    for (const action of ActionCatalog.all()) {
      const result = simulator.simulate(startState, action, {
        collectTrajectory: wantsTrajectory,
      });

      let targetR = result.endCell.r;
      let targetC = result.endCell.c;
      let isWinEdge = false;

      if (result.outcome === ActionOutcome.Won) {
        // The player touched an exit mid-action: point the edge at that
        // exit. Otherwise it would map to the player's own cell (often the
        // start) and be dropped as a self-loop.
        const exit = LevelGrid.exitOverlapping(result.endPos, exitCells);
        if (exit) {
          targetR = exit.r;
          targetC = exit.c;
          isWinEdge = true;
        }
      } else if (result.outcome !== ActionOutcome.Ok) {
        continue;
      }

      if (result.collided) continue;
      if (!grid.inBounds(targetR, targetC)) continue;
      if (!grid.isWalkable(targetR, targetC)) continue;
      // A normal edge must end on ground so the next edge starts settled.
      // A win edge ends on the exit, which needn't be grounded.
      if (!isWinEdge && !grid.isGrounded(targetR, targetC)) continue;
      const endVxB = StateKey.vxBucketOf(result.endState.vx);
      // Destinations are always the left-third node, so every edge
      // starts from a whole-pixel x.
      const endXOB = XOffsetBucket.Left;
      if (
        targetR === node.r && targetC === node.c &&
        endVxB === node.vxBucket && endXOB === node.xOffsetBucket
      ) continue;

      edgesArr.push({
        to: StateKey.of(targetR, targetC, endVxB, endXOB).toString(),
        kind: action.kind,
        cost: result.cost,
        dir: action.dir,
        action,
        recording: action.toRecording(0),
        endPos: result.endPos,
        endVel: result.endVel,
        endState: result.endState,
        isWinEdge,
      });

      // Precision landing: a one-tile pickup or exit can be passed through
      // without being the cell the action ends in. If the arc passes within
      // 2 px of a target's centre while descending, add an edge to it too.
      if (result.trajectory && result.outcome === ActionOutcome.Ok) {
        const endVxBp = StateKey.vxBucketOf(result.endState.vx);
        const endXOBp = XOffsetBucket.Left;
        for (const t of precisionTargets) {
          const tcx = t.c * TILE + TILE / 2;
          const tcy = t.r * TILE + TILE / 2;
          const tk = StateKey.of(t.r, t.c, endVxBp, endXOBp).toString();
          if (tk === StateKey.of(targetR, targetC, endVxBp, endXOBp).toString()) continue;
          if (
            t.r === node.r && t.c === node.c &&
            endVxBp === node.vxBucket && endXOBp === node.xOffsetBucket
          ) continue;
          let prevY = startState.y;
          for (const pt of result.trajectory) {
            const pcx = pt.x + TILE / 2;
            const pcy = pt.y + TILE / 2;
            const descending = pt.y > prevY;
            if (descending && Math.abs(pcx - tcx) <= 2 && Math.abs(pcy - tcy) <= 2) {
              edgesArr.push({
                to: tk,
                kind: action.kind,
                cost: result.cost,
                dir: action.dir,
                action,
                recording: action.toRecording(0),
                endPos: result.endPos,
                endVel: result.endVel,
                endState: result.endState,
                isWinEdge: false,
                precision: true,
              });
              break; // one precision edge per (node, action, target)
            }
            prevY = pt.y;
          }
        }
      }
    }
  }
}
