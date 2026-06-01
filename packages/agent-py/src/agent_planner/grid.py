"""v21 action-graph builder — the Python port of packages/agent/src/grid.js.

Edges are built BY SIMULATION: each candidate action is run through
simAction, and the resulting (end_cell, end_pos, end_vel) becomes the edge.
The agent picks an ACTION (direction + release-frame) and physics tells it
where the player ends up — edges are correct-by-construction.

This module backs the `bucket` planner backend (the v26/v27 bucket-aware
A*). The default backend is the per-frame planner in perframe.py; this is
kept callable for diagnostics + fallback.
"""

import math

from agent_adapter.constants import role_of

from .actions import action_to_recording, enumerate_actions
from .constants import GRAVITY, JUMP_FORCE, SPEED, TILE
from .sim_action import make_sim_context, simulate_action_in_context

# --- physics-derived constants (prefilter + v20.1 compat) -----------------

JUMP_FULL_TIME = (2 * JUMP_FORCE) / GRAVITY
MAX_HORIZ_PX = SPEED * JUMP_FULL_TIME
MAX_VERT_PX = (JUMP_FORCE * JUMP_FORCE) / (2 * GRAVITY)

# Max horizontal jump distance in CELLS at start-height (full arc).
JUMP_MAX_HORIZ_CELLS = math.floor(MAX_HORIZ_PX / TILE)
# Max vertical jump height in CELLS, rounded down for safety.
JUMP_MAX_VERT_CELLS = math.floor(MAX_VERT_PX / TILE)


def max_dc_for_dr(dr):
    """v20.1 — max horizontal cell-delta reachable while landing at `dr`.
    Retained as a sanity check; the v21 builder uses the simulator as
    ground truth, not this filter."""
    if dr == 0:
        return math.floor((SPEED * JUMP_FULL_TIME) / TILE)
    dr_px = dr * TILE
    disc = JUMP_FORCE * JUMP_FORCE + 2 * GRAVITY * dr_px
    if disc < 0:
        return -1
    t_later = (JUMP_FORCE + math.sqrt(disc)) / GRAVITY
    return math.floor((SPEED * t_later) / TILE)


# --- helpers --------------------------------------------------------------

def cell_key(r, c):
    return f"{r},{c}"


def state_key(r, c, vx_bucket=0, x_offset_bucket="L"):
    """Sub-pixel state-space A* node identity. Each grounded cell expands to
    9 nodes — one per (vx_bucket x x_offset_bucket) pair."""
    return f"{r},{c},{vx_bucket},{x_offset_bucket}"


VX_BUCKETS = [-1, 0, 1]


def vx_bucket_of(vx):
    """Bucket the player's vx into {-1, 0, +1}. Treat |vx| < 30 as 0."""
    if abs(vx) < 30:
        return 0
    return -1 if vx < 0 else 1


X_OFFSET_BUCKETS = ["L", "C", "R"]


def x_offset_bucket_of(x):
    """Bucket the player's AABB-left x within its cell into thirds."""
    sub = ((x % TILE) + TILE) % TILE
    if sub < TILE / 3:
        return "L"
    if sub < (2 * TILE) / 3:
        return "C"
    return "R"


def bucket_centre_x(c, x_offset_bucket):
    """Pick a representative AABB-left x for a given x_offset_bucket."""
    base_x = c * TILE
    if x_offset_bucket == "L":
        return base_x  # = sub-pixel 0
    if x_offset_bucket == "C":
        return base_x + TILE / 2  # ~ sub-pixel TILE/2
    return base_x + (5 * TILE) / 6  # ~ sub-pixel 5*TILE/6


def parse_state_key(k):
    """Parse a state_key back into (r, c, vx_bucket, x_offset_bucket)."""
    r_str, c_str, vx_str, x_off = k.split(",")
    return {"r": int(r_str), "c": int(c_str), "vx_bucket": int(vx_str), "x_offset_bucket": x_off}


def in_bounds(grid, r, c):
    return 0 <= r < len(grid) and 0 <= c < len(grid[r])


def is_walkable(grid, r, c):
    return in_bounds(grid, r, c) and grid[r][c] != "#" and grid[r][c] != "^"


def is_grounded(grid, r, c):
    return in_bounds(grid, r + 1, c) and grid[r + 1][c] == "#"


def settle(grid, r, c):
    cur = r
    while cur < len(grid) and is_walkable(grid, cur, c) and not is_grounded(grid, cur, c):
        cur += 1
    if cur >= len(grid):
        return None
    if not is_walkable(grid, cur, c):
        return None
    return {"r": cur, "c": c}


def _is_pickup(legend, ch):
    return role_of(legend, ch) == "pickup" or ch == "o"


# --- action-graph builder -------------------------------------------------

def build_nav_graph(adapter, parsed, legend=None, tileset=None):
    """Build the v21 action-graph.

    Returns a dict with nodes, edges, start, pickup_cells, exit_cells,
    width, height.
    """
    grid = parsed["grid"]
    nodes = {}
    edges = {}
    p_spawn = None
    pickup_cells = []
    exit_cells = []

    # Each walkable cell expands to 3 x 3 = 9 state_key nodes.
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if not is_walkable(grid, r, c):
                continue
            ch = grid[r][c]
            for vx_bucket in VX_BUCKETS:
                for x_offset_bucket in X_OFFSET_BUCKETS:
                    k = state_key(r, c, vx_bucket, x_offset_bucket)
                    nodes[k] = {
                        "r": r, "c": c, "vx_bucket": vx_bucket,
                        "x_offset_bucket": x_offset_bucket,
                        "supported": is_grounded(grid, r, c),
                    }
            if ch == "P":
                p_spawn = {"r": r, "c": c}
            elif ch == "E":
                exit_cells.append({"r": r, "c": c})
            elif _is_pickup(legend, ch):
                pickup_cells.append({"r": r, "c": c})

    # The player spawns mid-air at P and falls to the first grounded cell
    # below. For pathfinding, treat the settled cell as start.
    start = settle(grid, p_spawn["r"], p_spawn["c"]) if p_spawn else None

    ctx = make_sim_context(adapter, parsed, legend, tileset) if _can_build_sim_context(parsed) else None

    # Precision-landing targets — pickup cells + exit cells.
    precision_targets = [*pickup_cells, *exit_cells]

    for k, n in nodes.items():
        edges[k] = []
        if not is_grounded(grid, n["r"], n["c"]):
            continue
        if ctx is None:
            continue
        # v27 M4/M5: only L-bucket sources emit edges.
        if n["x_offset_bucket"] != "L":
            continue
        _add_action_edges(ctx, parsed, n, edges[k], exit_cells, precision_targets)

    return {
        "nodes": nodes,
        "edges": edges,
        "start": start,
        "pickup_cells": pickup_cells,
        "exit_cells": exit_cells,
        "width": parsed["meta"]["width"],
        "height": len(grid),
    }


def _can_build_sim_context(parsed):
    """to_world requires a player spawn (P). Tests sometimes pass levels
    without P; for those return an empty edge map."""
    for row in parsed["grid"]:
        if "P" in row:
            return True
    return False


def _add_action_edges(ctx, parsed, cell, edges_arr, exit_cells, precision_targets=()):
    start_vx = cell["vx_bucket"] * SPEED
    start_state = {
        "x": bucket_centre_x(cell["c"], cell["x_offset_bucket"]),
        "y": cell["r"] * TILE,
        "vx": start_vx,
        "vy": 0,
        "on_ground": True,
    }

    wants_trajectory = len(precision_targets) > 0
    grid = parsed["grid"]

    for action in enumerate_actions():
        result = simulate_action_in_context(ctx, start_state, action, collect_trajectory=wants_trajectory)

        target_r = result["end_cell"]["r"]
        target_c = result["end_cell"]["c"]
        is_win_edge = False

        if result["outcome"] == "won":
            exit_cell = find_overlapping_exit(result["end_pos"], exit_cells)
            if exit_cell:
                target_r = exit_cell["r"]
                target_c = exit_cell["c"]
                is_win_edge = True
        elif result["outcome"] != "ok":
            continue

        if result["collided"]:
            continue
        if not in_bounds(grid, target_r, target_c):
            continue
        if not is_walkable(grid, target_r, target_c):
            continue
        if not is_win_edge and not is_grounded(grid, target_r, target_c):
            continue
        end_vx_b = vx_bucket_of(result["end_state"]["vx"])
        end_xob = "L"
        if (target_r == cell["r"] and target_c == cell["c"]
                and end_vx_b == cell["vx_bucket"] and end_xob == cell["x_offset_bucket"]):
            continue

        edges_arr.append({
            "to": state_key(target_r, target_c, end_vx_b, end_xob),
            "kind": action["kind"],
            "cost": result["cost"],
            "dir": action["params"]["dir"],
            "action": action,
            "recording": action_to_recording(action, 0),
            "end_pos": result["end_pos"],
            "end_vel": result["end_vel"],
            "end_state": result["end_state"],
            "is_win_edge": is_win_edge,
        })

        # v25 M4: precision_landing.
        if result["trajectory"] and result["outcome"] == "ok":
            end_vx_bp = vx_bucket_of(result["end_state"]["vx"])
            end_xobp = "L"
            for t in precision_targets:
                tcx = t["c"] * TILE + TILE / 2
                tcy = t["r"] * TILE + TILE / 2
                tk = state_key(t["r"], t["c"], end_vx_bp, end_xobp)
                if tk == state_key(target_r, target_c, end_vx_bp, end_xobp):
                    continue
                if (t["r"] == cell["r"] and t["c"] == cell["c"]
                        and end_vx_bp == cell["vx_bucket"] and end_xobp == cell["x_offset_bucket"]):
                    continue
                prev_y = start_state["y"]
                for pt in result["trajectory"]:
                    pcx = pt["x"] + TILE / 2
                    pcy = pt["y"] + TILE / 2
                    descending = pt["y"] > prev_y
                    if descending and abs(pcx - tcx) <= 2 and abs(pcy - tcy) <= 2:
                        edges_arr.append({
                            "to": tk,
                            "kind": action["kind"],
                            "cost": result["cost"],
                            "dir": action["params"]["dir"],
                            "action": action,
                            "recording": action_to_recording(action, 0),
                            "end_pos": result["end_pos"],
                            "end_vel": result["end_vel"],
                            "end_state": result["end_state"],
                            "is_win_edge": False,
                            "precision": True,
                        })
                        break  # one precision edge per (cell, action, target)
                    prev_y = pt["y"]


def find_overlapping_exit(end_pos, exit_cells):
    """AABB overlap test between the player's end_pos and each exit cell."""
    for ec in exit_cells:
        ax = end_pos["x"]
        ay = end_pos["y"]
        bx = ec["c"] * TILE
        by = ec["r"] * TILE
        if ax < bx + TILE and ax + TILE > bx and ay < by + TILE and ay + TILE > by:
            return ec
    return None
