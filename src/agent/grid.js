// Nav-graph builder for the v20 agent. Reads the parsed level + legend
// and produces a typed-edge graph the planner walks via A*.
//
// Pure: no DOM, no engine, no rendering. The only engine touch is
// importing the physics constants (SPEED / JUMP_FORCE / GRAVITY) so
// the reach envelope is mechanically derived — if upstream tunes the
// jump, the agent's reach updates without any hand-tuning.
//
// Nodes:  every walkable cell (not `#`, not `^`, in-bounds).
// Edges:
//   walk  — horizontal neighbour where both cells are walkable AND grounded.
//   drop  — from a grounded cell, walking off the edge into an air cell
//           and falling to the first grounded cell below.
//   jump  — from a grounded cell, an arc landing inside the physics-
//           derived reach envelope (±H cols, −V..+lots rows) where the
//           straight-line between start + end doesn't cross a wall.

import { TILE, SPEED, JUMP_FORCE, GRAVITY } from '../play/constants.js';

// Derived from the engine constants (TDD v20 §6 / §16 explanation).
// JUMP_FULL_TIME = 2 * JUMP_FORCE / GRAVITY = full parabola duration
// (rise + fall back to start height).
// MAX_HORIZ_PX   = SPEED * JUMP_FULL_TIME (horizontal travel during a
//                  full-arc jump).
// MAX_VERT_PX    = JUMP_FORCE² / (2 * GRAVITY) (apex height above start).
const JUMP_FULL_TIME = (2 * JUMP_FORCE) / GRAVITY;
const MAX_HORIZ_PX = SPEED * JUMP_FULL_TIME;
const MAX_VERT_PX = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY);

/** Max horizontal jump distance in CELLS at start-height (full arc),
 *  rounded down for safety. */
export const JUMP_MAX_HORIZ_CELLS = Math.floor(MAX_HORIZ_PX / TILE);
/** Max vertical jump height in CELLS, rounded down for safety. */
export const JUMP_MAX_VERT_CELLS = Math.floor(MAX_VERT_PX / TILE);

/**
 * v20.1 — parabolic-envelope reach: max horizontal cell-delta the
 * player can cover while landing at a specific vertical cell-delta
 * `dr`. dr<0 is "above start" (jumping up), dr>0 is "below start"
 * (dropping during the arc). dr=0 = full arc, same height.
 *
 * Replaces the v20 rectangular envelope check (which independently
 * allowed |dr| ≤ 4 AND |dc| ≤ 8, accepting jumps like 8-across at
 * 3-up that the physics cannot actually achieve — at 3 cells up, the
 * arc has only carried the player ~6 cells, not 8).
 *
 * Derivation:
 *   y(t) = -JUMP_FORCE * t + 0.5 * GRAVITY * t²       (engine convention)
 *   x(t) = SPEED * t * sign(dir)
 *   Land when y(t) = dr * TILE:
 *     t = (JUMP_FORCE + sqrt(JUMP_FORCE² + 2 * GRAVITY * dr * TILE)) / GRAVITY
 *   Max horizontal cells = floor(SPEED * t / TILE).
 *
 * Returns -1 when the height is unreachable (above the apex).
 */
export function maxDcForDr(dr) {
  if (dr === 0) {
    const tFull = (2 * JUMP_FORCE) / GRAVITY;
    return Math.floor((SPEED * tFull) / TILE);
  }
  const drPx = dr * TILE;
  const disc = JUMP_FORCE * JUMP_FORCE + 2 * GRAVITY * drPx;
  if (disc < 0) return -1; // above apex — unreachable
  const tLater = (JUMP_FORCE + Math.sqrt(disc)) / GRAVITY;
  return Math.floor((SPEED * tLater) / TILE);
}

// Cost weights (in approximate frames) — used by A*. Walk is the cheapest;
// jump pays the arc duration; drop is walk + 3 frames per fallen row.
const WALK_COST = 5; // ≈ 5 frames per cell at SPEED=240, TILE=20
// v20 hotfix: JUMP_COST must reflect the *real* arc duration so A*
// doesn't prefer a jump-chain to a walk-chain over flat ground.
// Full jump arc = 2*JUMP_FORCE/GRAVITY = 0.7s = 42 frames at 60fps;
// +3 frames safety margin so the next emitted action lands AFTER the
// player has touched down (onGround = true → next jump fires cleanly).
// With cost 45, a 9-cell distance costs 45 frames as a jump or 45
// frames as a 9-cell walk — same — but for any 8-or-fewer-cell
// reach the walk strictly wins. Pure-jump scenarios (e.g. a gap with
// no walkable floor between platforms) still pick the jump because
// no walk edge exists at all.
const JUMP_COST = 45;
const DROP_BASE = 5;
const DROP_PER_ROW = 3;

const cellKey = (r, c) => `${r},${c}`;

function inBounds(grid, r, c) {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[r].length;
}
function isSolid(grid, r, c) {
  return !inBounds(grid, r, c) || grid[r][c] === '#';
}
function isHazard(grid, r, c) {
  return inBounds(grid, r, c) && grid[r][c] === '^';
}
/** Walkable = in-bounds, not solid, not hazard. */
function isWalkable(grid, r, c) {
  return inBounds(grid, r, c) && grid[r][c] !== '#' && grid[r][c] !== '^';
}
/** Grounded = there's an in-bounds `#` immediately below the cell.
 *  Off-grid-below is NOT grounded (player falls past the bottom of the
 *  world; the engine's toWorld() only emits Platform AABBs from explicit
 *  `#` cells, so off-grid has no collider). This is the physical
 *  ground test — distinct from the renderer's `isSolid` which treats
 *  off-grid as dirt for autotile masking. */
function isGrounded(grid, r, c) {
  return inBounds(grid, r + 1, c) && grid[r + 1][c] === '#';
}

/**
 * From cell (r, c), find the cell the player would land in if dropped
 * (gravity-only fall). Returns null if they fall out of bounds (= die).
 */
function settle(grid, r, c) {
  let cur = r;
  while (cur < grid.length && isWalkable(grid, cur, c) && !isGrounded(grid, cur, c)) {
    cur++;
  }
  if (cur >= grid.length) return null; // fell off the world → death
  if (!isWalkable(grid, cur, c)) return null; // landed on / inside a hazard
  return { r: cur, c };
}

/**
 * Approximate "is the path between (r0,c0) and (r1,c1) clear of solid
 * tiles?". We sample along the straight line; the actual jump path is
 * a parabola, but a clear straight line is a reasonable necessary
 * condition for v20. (Pathological "arc over a wall" cases are caught
 * by the runner's headless-sim validation: failed jumps trigger a
 * replan that excludes that edge.)
 *
 * v20.1: superseded for jump edges by isParabolaClear (below); kept
 * for non-jump uses and as a coarse short-circuit.
 */
function isLineClear(grid, r0, c0, r1, c1) {
  const dr = r1 - r0;
  const dc = c1 - c0;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return true;
  for (let i = 1; i < steps; i++) {
    const r = r0 + Math.round((i * dr) / steps);
    const c = c0 + Math.round((i * dc) / steps);
    if (isSolid(grid, r, c)) return false;
  }
  return true;
}

/**
 * v20.1 — sample the actual parabola, not its bounding straight line,
 * to validate that the player's AABB clears every `#` cell along the
 * jump arc. The player launches from `(sr, sc)` with the held
 * direction set toward `(tr, tc)`, follows the engine's physics
 * (vy starts at -JUMP_FORCE, gravity GRAVITY downward, vx = ±SPEED),
 * and we check the AABB at 8 evenly-spaced moments in the arc.
 *
 * This catches "straight line is clear but the arc dips into a wall
 * mid-flight" cases that the v20 line-check missed. Conversely it's
 * still an approximation — between samples the AABB could clip a
 * wall briefly. 8 samples (a player AABB is one cell, so ~12 px per
 * sample at full SPEED) is enough for cell-grain validation.
 */
function isParabolaClear(grid, sr, sc, tr, tc) {
  const dc = tc - sc;
  if (dc === 0) return false; // vertical-only jump goes nowhere useful
  const dir = Math.sign(dc);
  // Time when the arc returns to the target's y. The "+ sqrt" branch
  // is the downward (later) crossing.
  const drPx = (tr - sr) * TILE;
  const disc = JUMP_FORCE * JUMP_FORCE + 2 * GRAVITY * drPx;
  if (disc < 0) return false; // physically unreachable
  const tLand = (JUMP_FORCE + Math.sqrt(disc)) / GRAVITY;
  const samples = 8;
  for (let i = 1; i < samples; i++) {
    const t = (i / samples) * tLand;
    const xPx = sc * TILE + dir * SPEED * t;
    const yPx = sr * TILE + (-JUMP_FORCE * t + 0.5 * GRAVITY * t * t);
    // AABB at (xPx, yPx, TILE, TILE) — clamp to "just inside" so a
    // landing-precise touch on the cell-edge below isn't a collision.
    const c0 = Math.floor(xPx / TILE);
    const c1 = Math.floor((xPx + TILE - 0.001) / TILE);
    const r0 = Math.floor(yPx / TILE);
    const r1 = Math.floor((yPx + TILE - 0.001) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[r].length) continue;
        if (grid[r][c] === '#') return false;
      }
    }
  }
  return true;
}

function addWalkEdges(grid, n, edges) {
  if (!isGrounded(grid, n.r, n.c)) return;
  for (const dc of [-1, 1]) {
    const r = n.r;
    const c = n.c + dc;
    if (isWalkable(grid, r, c) && isGrounded(grid, r, c)) {
      edges.push({
        to: cellKey(r, c),
        kind: 'walk',
        cost: WALK_COST,
        dir: dc > 0 ? 'right' : 'left',
      });
    }
  }
}

function addDropEdges(grid, n, edges) {
  if (!isGrounded(grid, n.r, n.c)) return;
  for (const dc of [-1, 1]) {
    const r0 = n.r;
    const c0 = n.c + dc;
    if (!isWalkable(grid, r0, c0)) continue;
    if (isGrounded(grid, r0, c0)) continue; // walk edge handles this
    const landing = settle(grid, r0, c0);
    if (!landing) continue; // off the world or onto hazard
    edges.push({
      to: cellKey(landing.r, landing.c),
      kind: 'drop',
      cost: DROP_BASE + (landing.r - r0) * DROP_PER_ROW,
      dir: dc > 0 ? 'right' : 'left',
    });
  }
}

function addJumpEdges(grid, n, edges) {
  if (!isGrounded(grid, n.r, n.c)) return;
  // v20.1: parabolic envelope (max |dc| varies with dr), not a
  // rectangle. Skip dc=0 (vertical-only) entirely — those land the
  // player back at the same cell.
  for (let dr = -JUMP_MAX_VERT_CELLS; dr <= JUMP_MAX_VERT_CELLS; dr++) {
    const maxDc = maxDcForDr(dr);
    if (maxDc <= 0) continue;
    for (let dc = -maxDc; dc <= maxDc; dc++) {
      if (dc === 0) continue;
      const r = n.r + dr;
      const c = n.c + dc;
      if (!isWalkable(grid, r, c)) continue;
      if (!isGrounded(grid, r, c)) continue; // jump targets must be landings
      // Skip cases the walk edge already covers (immediate same-row neighbour).
      if (dr === 0 && Math.abs(dc) === 1) continue;
      // v20.1: parabolic-arc clearance check replaces the v20
      // straight-line check. Catches cases like "8-cell jump at 3-up
      // crosses tower wall during descent" that the line-check missed.
      if (!isParabolaClear(grid, n.r, n.c, r, c)) continue;
      edges.push({
        to: cellKey(r, c),
        kind: 'jump',
        cost: JUMP_COST,
        dir: dc > 0 ? 'right' : 'left',
      });
    }
  }
}

/**
 * Build the nav-graph for a parsed level.
 *
 * @param {{grid: string[], meta: object}} parsed
 * @param {object|null} [legend]
 * @returns {{
 *   nodes:        Map<string, {r:number, c:number, supported:boolean}>,
 *   edges:        Map<string, Array<{to:string, kind:string, cost:number, dir?:string}>>,
 *   start:        {r:number, c:number} | null,
 *   pickupCells:  Array<{r:number, c:number}>,
 *   exitCells:    Array<{r:number, c:number}>,
 *   width:        number,
 *   height:       number,
 * }}
 */
export function buildNavGraph(parsed, legend = null) {
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

  // The player spawns mid-air at the P cell and falls to the first
  // grounded cell below. For pathfinding, treat the settled cell as
  // the agent's starting node.
  const start = pSpawn ? settle(grid, pSpawn.r, pSpawn.c) : null;

  for (const [k, n] of nodes) {
    const arr = [];
    addWalkEdges(grid, n, arr);
    addDropEdges(grid, n, arr);
    addJumpEdges(grid, n, arr);
    edges.set(k, arr);
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

// Exported for the planner + tests; cellKey is used by both.
export { cellKey, isSolid, isWalkable, isGrounded, settle, isLineClear };
