// v21 action-graph builder. Replaces the v20.1 analytic edge model
// (per-dr envelope + straight-line parabola check) with edges built
// BY SIMULATION: each candidate action is run through `simAction`,
// and the resulting (endCell, endPos, endVel) becomes the edge.
//
// Why this matters: v20 + v20.1 had a "cell-pair edge" model where
// the agent CHOSE a target cell and the recording held direction for
// the full arc. Physically, the held-direction parabola lands at one
// specific cell, not whichever cell the agent picked. v21 inverts:
// the agent picks an ACTION (direction + release-frame), and physics
// tells it where they end up. Edges are correct-by-construction.
//
// Performance: one `PlaytestScene` instance + `toWorld()` call per
// `buildNavGraph` call (not per action). ~28 simulations per
// grounded cell × ~hundreds of cells. Each sim is ~50µs of JS, no
// canvas. Targets <500ms for typical 24×14 levels.
//
// Backward-compat: the v20 exports (`buildNavGraph`, `cellKey`,
// `maxDcForDr`, `JUMP_MAX_HORIZ_CELLS`, `JUMP_MAX_VERT_CELLS`) are
// preserved. Each edge still carries `to`, `kind`, `cost`, `dir`
// plus new fields the v21 planner reads (`action`, `recording`,
// `endPos`, `endVel`).

import { TILE, SPEED, JUMP_FORCE, GRAVITY } from '../play/constants.js';
import { enumerateActions, actionToRecording } from './actions.js';
import { makeSimContext, simulateActionInContext } from './simAction.js';

// --- physics-derived constants (kept for v20.1 compat + prefilter) ---

const JUMP_FULL_TIME = (2 * JUMP_FORCE) / GRAVITY;
const MAX_HORIZ_PX = SPEED * JUMP_FULL_TIME;
const MAX_VERT_PX = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY);

/** Max horizontal jump distance in CELLS at start-height (full arc). */
export const JUMP_MAX_HORIZ_CELLS = Math.floor(MAX_HORIZ_PX / TILE);
/** Max vertical jump height in CELLS, rounded down for safety. */
export const JUMP_MAX_VERT_CELLS = Math.floor(MAX_VERT_PX / TILE);

/**
 * v20.1 — max horizontal cell-delta reachable while landing at `dr`.
 * Retained as a public export for v20-era callers and as a sanity
 * check (the v21 graph builder doesn't use it to FILTER, since the
 * simulator is the ground truth).
 */
export function maxDcForDr(dr) {
  if (dr === 0) return Math.floor((SPEED * JUMP_FULL_TIME) / TILE);
  const drPx = dr * TILE;
  const disc = JUMP_FORCE * JUMP_FORCE + 2 * GRAVITY * drPx;
  if (disc < 0) return -1;
  const tLater = (JUMP_FORCE + Math.sqrt(disc)) / GRAVITY;
  return Math.floor((SPEED * tLater) / TILE);
}

// --- helpers (same as v20) ------------------------------------------

export const cellKey = (r, c) => `${r},${c}`;

function inBounds(grid, r, c) {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[r].length;
}
function isWalkable(grid, r, c) {
  return inBounds(grid, r, c) && grid[r][c] !== '#' && grid[r][c] !== '^';
}
function isGrounded(grid, r, c) {
  return inBounds(grid, r + 1, c) && grid[r + 1][c] === '#';
}
function settle(grid, r, c) {
  let cur = r;
  while (cur < grid.length && isWalkable(grid, cur, c) && !isGrounded(grid, cur, c)) {
    cur++;
  }
  if (cur >= grid.length) return null;
  if (!isWalkable(grid, cur, c)) return null;
  return { r: cur, c };
}

// --- action-graph builder -------------------------------------------

/**
 * Build the v21 action-graph.
 *
 * @param parsed   level.parse() result
 * @param legend   active tileset legend
 * @param tileset  active tileset object (or null for offline / Dirt-only)
 *
 * @returns {{
 *   nodes:       Map<string, {r, c, supported}>,
 *   edges:       Map<string, Array<{
 *                  to:string, kind:string, cost:number, dir:string,
 *                  action:object, recording:Array, endPos:{x,y}, endVel:{vx,vy},
 *                }>>,
 *   start:       {r, c} | null,
 *   pickupCells: Array<{r, c}>,
 *   exitCells:   Array<{r, c}>,
 *   width:       number,
 *   height:      number,
 * }}
 */
export function buildNavGraph(parsed, legend = null, tileset = null) {
  const grid = parsed.grid;
  const nodes = new Map();
  const edges = new Map();
  let pSpawn = null;
  const pickupCells = [];
  const exitCells = [];

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!isWalkable(grid, r, c)) continue;
      const ch = grid[r][c];
      const k = cellKey(r, c);
      nodes.set(k, { r, c, supported: isGrounded(grid, r, c) });
      if (ch === 'P') pSpawn = { r, c };
      else if (ch === 'E') exitCells.push({ r, c });
      else if (legend?.[ch]?.role === 'pickup' || ch === 'o') pickupCells.push({ r, c });
    }
  }

  // The player spawns mid-air at P and falls to the first grounded
  // cell below. For pathfinding, treat the settled cell as start.
  const start = pSpawn ? settle(grid, pSpawn.r, pSpawn.c) : null;

  // Build action-edges. Reuse a single PlaytestScene across all
  // actions to avoid per-action toWorld() overhead.
  const ctx = canBuildSimContext(parsed)
    ? makeSimContext(parsed, legend, tileset)
    : null;

  // v25 M4: precision-landing targets — pickup cells + exit cells.
  // When non-empty, addActionEdges requests per-frame trajectories
  // from simAction and emits additional edges to targets the
  // trajectory passes within ±2 px of (centre-to-centre). Lets the
  // agent reach 1-tile pickups that the cell-resolved edge model
  // misses. When empty (level has no pickups + no exit, rare),
  // trajectory collection is skipped — back-compat fast path.
  const precisionTargets = [...pickupCells, ...exitCells];

  for (const [k, n] of nodes) {
    edges.set(k, []);
    if (!isGrounded(grid, n.r, n.c)) continue;
    if (!ctx) continue;
    addActionEdges(ctx, parsed, n, edges.get(k), exitCells, precisionTargets);
  }

  return {
    nodes,
    edges,
    start,
    pickupCells,
    exitCells,
    width: parsed.meta.width,
    height: grid.length,
  };
}

/** Can we construct a PlaytestScene for this level? toWorld requires
 *  a player spawn (P). Tests sometimes pass levels without P; for
 *  those we return an empty edge map (the graph is still useful for
 *  cell/start/pickup inspection). */
function canBuildSimContext(parsed) {
  for (const row of parsed.grid) {
    if (row.includes('P')) return true;
  }
  return false;
}

function addActionEdges(ctx, parsed, cell, edgesArr, exitCells, precisionTargets = []) {
  const startState = {
    x: cell.c * TILE,
    y: cell.r * TILE,
    vx: 0,
    vy: 0,
    onGround: true,
  };

  // v25 M4: request trajectory when we have targets to check
  // against. Each precision-landing target = a cell where landing
  // would otherwise not be detected by cell-resolved end position.
  const wantsTrajectory = precisionTargets.length > 0;

  for (const action of enumerateActions()) {
    const result = simulateActionInContext(ctx, startState, action, {
      collectTrajectory: wantsTrajectory,
    });

    let targetR = result.endCell.r;
    let targetC = result.endCell.c;
    let isWinEdge = false;

    if (result.outcome === 'won') {
      // The player touched an exit mid-action — find which one their
      // AABB overlapped and redirect the edge there. Without this,
      // edges that "win on touch" would map to the player's centre-
      // cell (often the start cell) and the self-loop filter would
      // drop them.
      const exit = findOverlappingExit(result.endPos, exitCells);
      if (exit) {
        targetR = exit.r;
        targetC = exit.c;
        isWinEdge = true;
      }
    } else if (result.outcome !== 'ok') {
      continue;
    }

    if (result.collided) continue;
    if (!inBounds(parsed.grid, targetR, targetC)) continue;
    if (!isWalkable(parsed.grid, targetR, targetC)) continue;
    // For non-win edges, the player must end on a grounded cell (so a
    // subsequent edge can start from a settled state). Win edges end
    // ON the exit — exits aren't required to be grounded for the
    // collision to fire.
    if (!isWinEdge && !isGrounded(parsed.grid, targetR, targetC)) continue;
    if (targetR === cell.r && targetC === cell.c) continue;

    edgesArr.push({
      to: cellKey(targetR, targetC),
      kind: action.kind,
      cost: result.cost,
      dir: action.params.dir,
      action,
      recording: actionToRecording(action, 0),
      endPos: result.endPos,
      endVel: result.endVel,
      // v25 M1: sub-pixel + full physics endState — consumed by
      // the v25 M2 planner re-simulation so chained edges don't
      // drift relative to the build-time prediction.
      endState: result.endState,
      isWinEdge,
    });

    // v25 M4: precision_landing. For each precisionTarget the
    // trajectory passes within ±2 px of (centre-to-centre) while
    // DESCENDING (vy > 0 at the previous frame), emit an
    // additional edge to that target's cell. AABB-vs-cell-centre
    // is the natural test for a 1-tile target — the player's
    // centre must be near the target's centre with some downward
    // momentum. Skipped when result.trajectory is null (no
    // precision targets requested).
    if (result.trajectory && result.outcome === 'ok') {
      for (const t of precisionTargets) {
        const tcx = t.c * TILE + TILE / 2;
        const tcy = t.r * TILE + TILE / 2;
        const tk = cellKey(t.r, t.c);
        // Skip self-loops and the regular-cell-resolved target (it
        // already has an edge above).
        if (tk === cellKey(targetR, targetC)) continue;
        if (t.r === cell.r && t.c === cell.c) continue;
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
              dir: action.params.dir,
              action,
              recording: actionToRecording(action, 0),
              endPos: result.endPos,
              endVel: result.endVel,
              endState: result.endState,
              isWinEdge: false,
              precision: true,
            });
            break; // one precision edge per (cell, action, target)
          }
          prevY = pt.y;
        }
      }
    }
  }
}

function findOverlappingExit(endPos, exitCells) {
  for (const ec of exitCells) {
    const ax = endPos.x;
    const ay = endPos.y;
    const bx = ec.c * TILE;
    const by = ec.r * TILE;
    if (ax < bx + TILE && ax + TILE > bx && ay < by + TILE && ay + TILE > by) {
      return ec;
    }
  }
  return null;
}

// Backward-compat exports (some tests + the planner may import these).
export { settle, inBounds, isWalkable, isGrounded };
