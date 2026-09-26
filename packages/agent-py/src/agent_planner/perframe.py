"""v28 per-frame trajectory planner — the Python port of
packages/agent/src/perframe.js.

The architectural successor to the bucket-aware A*. A* nodes carry the FULL
continuous-physics exact state; edges are produced on-the-fly by simulating
actions from that exact state. The chain is exact by construction — the
recording it emits replays byte-identically on the live engine.
"""

import math


from .actions import (
    DROP_HOLD_FRAMES_BUDGET,
    WALK_FRAMES_PER_CELL,
    action_to_recording,
    enumerate_actions,
)
from .constants import TILE
from .grid import (
    cell_key,
    find_overlapping_exit,
    glyph_role,
    in_bounds,
    is_grounded,
    is_walkable,
    settle,
)
from .sim_action import make_sim_context, simulate_action_in_context


def _js_round(x):
    """Mirror JS Math.round (round half towards +Infinity), which differs
    from Python's banker's rounding at exact .5 boundaries. Cluster keys
    depend on this matching the JS planner exactly."""
    return math.floor(x + 0.5)


# Tolerances for the equivalence-class lookup. Two exact states whose
# scalars round to the same bucket under these tolerances are treated as
# the same A* node for visited / gScore purposes. Same-on_ground is
# enforced strictly (the physics branches sharply on it).
DEFAULT_CLUSTER_TOL = {"x": 0.5, "y": 0.5, "vx": 5, "vy": 5}


def cluster_key(state, tol=None):
    """Compute the cluster key for an exact state. Pure."""
    tol = tol or DEFAULT_CLUSTER_TOL
    cx = _js_round(state["x"] / tol["x"])
    cy = _js_round(state["y"] / tol["y"])
    cvx = _js_round(state["vx"] / tol["vx"])
    cvy = _js_round(state["vy"] / tol["vy"])
    return f"{cx},{cy},{cvx},{cvy},{1 if state['on_ground'] else 0}"


def nearby(a, b, tol=None):
    """True when two states fall in the same equivalence class."""
    tol = tol or DEFAULT_CLUSTER_TOL
    return cluster_key(a, tol) == cluster_key(b, tol)


# ---- expand_node: on-demand edge generation ------------------------------

def make_context_cache():
    """Build a fresh sim-context cache. Pass this to expand_node across all
    calls within a single plan() invocation so the scene is created exactly
    once per parsed level. Keyed by parsed object identity."""
    return {}


def _get_context(cache, adapter, parsed, legend, tileset):
    ctx = cache.get(id(parsed))
    if ctx is None:
        ctx = make_sim_context(adapter, parsed, legend, tileset)
        cache[id(parsed)] = ctx
    return ctx


def expand_node(cache, parsed, legend, tileset, state, adapter=None, exit_cells=(), precision_targets=()):
    """Generate every reachable edge from the exact `state`. Runs each of
    the 46 actions through simulate_action; keeps the ones that land on a
    walkable cell (grounded for non-win edges); also emits precision-landing
    edges to 1-tile pickup/exit targets the trajectory passes +/-2 px of
    during descent."""
    ctx = _get_context(cache, adapter, parsed, legend, tileset)
    wants_trajectory = len(precision_targets) > 0
    grid = parsed["grid"]
    edges = []

    for action in enumerate_actions():
        result = simulate_action_in_context(ctx, state, action, collect_trajectory=wants_trajectory)

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
        if not is_walkable(grid, target_r, target_c, legend):
            continue
        if not is_win_edge and not is_grounded(grid, target_r, target_c, legend):
            continue

        edges.append({
            "to_cell": {"r": target_r, "c": target_c},
            "to_state": result["end_state"],
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

        # v25 M4 precision-landing rule (no bucketing on the destination —
        # to_state is the live end_state).
        if result["trajectory"] and result["outcome"] == "ok":
            for t in precision_targets:
                tcx = t["c"] * TILE + TILE / 2
                tcy = t["r"] * TILE + TILE / 2
                if t["r"] == target_r and t["c"] == target_c:
                    continue
                if (t["r"] == math.floor((state["y"] + TILE / 2) / TILE)
                        and t["c"] == math.floor((state["x"] + TILE / 2) / TILE)):
                    continue
                prev_y = state["y"]
                for pt in result["trajectory"]:
                    pcx = pt["x"] + TILE / 2
                    pcy = pt["y"] + TILE / 2
                    descending = pt["y"] > prev_y
                    if descending and abs(pcx - tcx) <= 2 and abs(pcy - tcy) <= 2:
                        edges.append({
                            "to_cell": {"r": t["r"], "c": t["c"]},
                            "to_state": result["end_state"],
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
                        break
                    prev_y = pt["y"]
    return edges


# ---- Goal discovery + per-frame A* ---------------------------------------

def discover_goals(parsed, legend):
    """Locate the spawn (settled), pickup cells, and exit cells without
    building the bucket-aware nav-graph. O(rows x cols)."""
    grid = parsed["grid"]
    p_spawn = None
    pickup_cells = []
    exit_cells = []
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if not is_walkable(grid, r, c, legend):
                continue
            role = glyph_role(legend, grid[r][c])
            if role == "player":
                p_spawn = {"r": r, "c": c}
            elif role == "exit":
                exit_cells.append({"r": r, "c": c})
            elif role == "pickup":
                pickup_cells.append({"r": r, "c": c})
    start = settle(grid, p_spawn["r"], p_spawn["c"], legend) if p_spawn else None
    return {"start": start, "pickup_cells": pickup_cells, "exit_cells": exit_cells, "p_spawn": p_spawn}


def _heuristic(r_a, c_a, r_b, c_b):
    """Manhattan cell distance x WALK_FRAMES_PER_CELL. Admissible."""
    return (abs(r_a - r_b) + abs(c_a - c_b)) * WALK_FRAMES_PER_CELL


def _edge_sort_key(edge):
    """Deterministic tie-break for edges with equal f-score."""
    a = edge.get("action") or {}
    p = a.get("params") or {}
    return "|".join([
        a.get("kind") or "",
        p.get("dir") or "",
        str(p.get("hold_frames") if p.get("hold_frames") is not None else ""),
        str(p.get("release_frame") if p.get("release_frame") is not None else ""),
        str(p.get("walk_cells") if p.get("walk_cells") is not None else ""),
    ])


DEFAULT_NODE_CAP = 100_000


def step_id(from_cell, edge):
    """The id of a step from cell `from_cell` along `edge`:
    "fromR,fromC>toR,toC:kind" (mirrors PerFramePlanner.stepId). Blocking an
    id rules out that kind of move between those two cells."""
    return f"{from_cell['r']},{from_cell['c']}>{edge['to_cell']['r']},{edge['to_cell']['c']}:{edge['kind']}"


def a_star_per_frame(parsed, legend, tileset, from_state, goal_cell_key, adapter=None,
                     exit_cells=(), precision_targets=(), cache=None, tol=None, node_cap=None,
                     blocked=None):
    """Per-frame A* from `from_state` to any cell matching `goal_cell_key`
    ("r,c"), never taking a step whose step_id is in `blocked`. Returns a
    list of {"from", "edge", "from_state", "from_cell"} steps or None on
    failure."""
    blocked = blocked or set()
    cache = cache if cache is not None else make_context_cache()
    tol = tol or DEFAULT_CLUSTER_TOL
    node_cap = node_cap if node_cap is not None else DEFAULT_NODE_CAP

    tr, tc = (int(v) for v in goal_cell_key.split(","))

    def matches_goal(cell_r, cell_c):
        return cell_r == tr and cell_c == tc

    from_r = math.floor((from_state["y"] + TILE / 2) / TILE)
    from_c = math.floor((from_state["x"] + TILE / 2) / TILE)
    if matches_goal(from_r, from_c):
        return []

    start_ck = cluster_key(from_state, tol)
    # Insertion-ordered dict so the lowest-f tie-break matches JS Map order.
    open_set = {start_ck: {"state": from_state, "cell_r": from_r, "cell_c": from_c}}
    g_score = {start_ck: 0}
    f_score = {start_ck: _heuristic(from_r, from_c, tr, tc)}
    came_from = {}

    expanded = 0
    while open_set and expanded < node_cap:
        # Pick lowest f-score from open (strict <, first wins on tie).
        cur_ck = None
        cur_best = math.inf
        for ck in open_set:
            f = f_score.get(ck, math.inf)
            if f < cur_best:
                cur_best = f
                cur_ck = ck
        cur_node = open_set[cur_ck]
        del open_set[cur_ck]
        expanded += 1

        if matches_goal(cur_node["cell_r"], cur_node["cell_c"]):
            path = []
            ck = cur_ck
            while ck in came_from:
                entry = came_from[ck]
                path.insert(0, {"from": entry["from"], "edge": entry["edge"], "from_state": entry["from_state"],
                                "from_cell": entry["from_cell"]})
                ck = entry["from"]
            return path

        edges = expand_node(cache, parsed, legend, tileset, cur_node["state"],
                            adapter=adapter, exit_cells=exit_cells, precision_targets=precision_targets)
        edges.sort(key=_edge_sort_key)

        cur_g = g_score.get(cur_ck, math.inf)
        cur_cell = {"r": cur_node["cell_r"], "c": cur_node["cell_c"]}
        for edge in edges:
            if blocked and step_id(cur_cell, edge) in blocked:
                continue
            next_ck = cluster_key(edge["to_state"], tol)
            tentative = cur_g + edge["cost"]
            if tentative < g_score.get(next_ck, math.inf):
                came_from[next_ck] = {"from": cur_ck, "edge": edge, "from_state": cur_node["state"],
                                      "from_cell": cur_cell}
                g_score[next_ck] = tentative
                f_score[next_ck] = tentative + _heuristic(edge["to_cell"]["r"], edge["to_cell"]["c"], tr, tc)
                open_set[next_ck] = {
                    "state": edge["to_state"],
                    "cell_r": edge["to_cell"]["r"],
                    "cell_c": edge["to_cell"]["c"],
                }
    return None


def plan_per_frame(parsed, legend, tileset, adapter=None, tol=None, node_cap=None, blocked=None):
    """Top-level per-frame planner. Discovers goals, runs A* per leg,
    threads the action recording. Mirrors planner.plan's contract but does
    NOT use bucket-aware A*. Steps in `blocked` (see step_id) are never taken."""
    goals_info = discover_goals(parsed, legend)
    start = goals_info["start"]
    pickup_cells = goals_info["pickup_cells"]
    exit_cells = goals_info["exit_cells"]
    if not start or len(exit_cells) == 0:
        return {"trace": [], "recording": [], "stats": {"steps": 0, "jumps": 0, "walks": 0, "drops": 0},
                "graph": None, "goals": [], "unreachable": []}

    stub_graph = {
        "pickup_cells": pickup_cells, "exit_cells": exit_cells, "start": start,
        "width": parsed["meta"]["width"], "height": len(parsed["grid"]),
    }
    pickup_required = (parsed.get("meta") or {}).get("pickupRequired", "all")
    exit_key = cell_key(exit_cells[0]["r"], exit_cells[0]["c"])
    if pickup_required == "all":
        need = len(pickup_cells)
    elif pickup_required == 0:
        need = 0
    else:
        need = min(pickup_required, len(pickup_cells))

    goals = []
    cur_state = {"x": start["c"] * TILE, "y": start["r"] * TILE, "vx": 0, "vy": 0, "on_ground": True}
    # Greedy nearest pickup ordering.
    remaining = [cell_key(p["r"], p["c"]) for p in pickup_cells]
    for _ in range(need):
        best_key = None
        best_dist = math.inf
        cur_r = math.floor((cur_state["y"] + TILE / 2) / TILE)
        cur_c = math.floor((cur_state["x"] + TILE / 2) / TILE)
        for k in remaining:
            r, c = (int(v) for v in k.split(","))
            d = abs(r - cur_r) + abs(c - cur_c)
            if d < best_dist:
                best_dist = d
                best_key = k
        if not best_key:
            break
        goals.append(best_key)
        remaining.remove(best_key)
        r, c = (int(v) for v in best_key.split(","))
        cur_state = {"x": c * TILE, "y": r * TILE, "vx": 0, "vy": 0, "on_ground": True}
    goals.append(exit_key)

    cache = make_context_cache()
    ctx = {
        "recording": [],
        "trace": [],
        "stats": {"steps": 0, "jumps": 0, "walks": 0, "drops": 0},
        "frame": 1,
        "current_dir": None,
        "state": {"x": start["c"] * TILE, "y": start["r"] * TILE, "vx": 0, "vy": 0, "on_ground": True},
        "cache": cache,
        "parsed": parsed, "legend": legend, "tileset": tileset,
        "exit_cells": exit_cells,
        "precision_targets": [*pickup_cells, *exit_cells],
    }

    unreachable = []
    for goal in goals:
        gr, gc = (int(v) for v in goal.split(","))
        path = a_star_per_frame(parsed, legend, tileset, ctx["state"], goal,
                                adapter=adapter, cache=cache, exit_cells=exit_cells,
                                precision_targets=ctx["precision_targets"], tol=tol, node_cap=node_cap,
                                blocked=blocked)
        subgoal_name = _describe_goal(goal, exit_cells, pickup_cells)
        if path is None:
            is_exit = any(e["r"] == gr and e["c"] == gc for e in exit_cells)
            if is_exit:
                return {
                    "trace": ctx["trace"], "recording": ctx["recording"], "stats": ctx["stats"],
                    "graph": stub_graph, "goals": goals,
                    "unreachable": [*unreachable, {"r": gr, "c": gc, "kind": "exit"}],
                }
            unreachable.append({"r": gr, "c": gc, "kind": "pickup"})
            continue
        _emit_per_frame_leg(path, subgoal_name, ctx)

    # Final release — drop the last held direction so the player doesn't
    # keep walking past the exit if extra frames run.
    if ctx["current_dir"]:
        ctx["recording"].append({"frame": ctx["frame"], "key": ctx["current_dir"], "down": False})
        ctx["current_dir"] = None
    return {
        "trace": ctx["trace"],
        "recording": ctx["recording"],
        "stats": ctx["stats"],
        "graph": stub_graph,
        "goals": goals,
        "unreachable": unreachable,
    }


def _describe_goal(goal_key, exit_cells, pickup_cells):
    """Describe a goal cell_key for the trace's `why:` strings."""
    r, c = (int(v) for v in goal_key.split(","))
    if any(e["r"] == r and e["c"] == c for e in exit_cells):
        return f"exit at ({c},{r})"
    idx = next((i for i, p in enumerate(pickup_cells) if p["r"] == r and p["c"] == c), -1)
    if idx >= 0:
        return f"pickup #{idx + 1} at ({c},{r})"
    return f"target ({c},{r})"


def _emit_per_frame_leg(steps, subgoal_name, ctx):
    """Append the leg's action recording + trace entries to ctx, threading
    direction-key + jump-tap semantics. The chain is EXACT by construction
    (A*'s edges were simulated from the live exact state), so no re-sim is
    needed."""
    for step in steps:
        edge = step["edge"]
        d = edge["dir"]

        if d in ("left", "right"):
            if ctx["current_dir"] != d:
                if ctx["current_dir"]:
                    ctx["recording"].append({"frame": ctx["frame"], "key": ctx["current_dir"], "down": False})
                ctx["recording"].append({"frame": ctx["frame"], "key": d, "down": True})
                ctx["current_dir"] = d

        params = edge.get("action", {}).get("params", {})
        if edge["kind"] == "jump":
            ctx["recording"].append({"frame": ctx["frame"], "key": "space", "down": True})
            ctx["recording"].append({"frame": ctx["frame"] + 1, "key": "space", "down": False})
            hf = params.get("hold_frames")
            if hf is not None and hf < edge["cost"] and ctx["current_dir"]:
                ctx["recording"].append({"frame": ctx["frame"] + hf, "key": ctx["current_dir"], "down": False})
                ctx["current_dir"] = None
            ctx["stats"]["jumps"] += 1
        elif edge["kind"] == "walk":
            ctx["stats"]["walks"] += 1
        elif edge["kind"] == "drop":
            release_at = ctx["frame"] + DROP_HOLD_FRAMES_BUDGET
            if ctx["current_dir"] and release_at < ctx["frame"] + edge["cost"]:
                ctx["recording"].append({"frame": release_at, "key": ctx["current_dir"], "down": False})
                ctx["current_dir"] = None
            ctx["stats"]["drops"] += 1
        elif edge["kind"] == "drop_release":
            rf = params.get("release_frame")
            if rf is not None and rf < edge["cost"] and ctx["current_dir"]:
                ctx["recording"].append({"frame": ctx["frame"] + rf, "key": ctx["current_dir"], "down": False})
                ctx["current_dir"] = None
            ctx["stats"]["drops"] += 1
        elif edge["kind"] == "run_off":
            wc = params.get("walk_cells") or 0
            release_at = ctx["frame"] + wc * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET
            if ctx["current_dir"] and release_at < ctx["frame"] + edge["cost"]:
                ctx["recording"].append({"frame": release_at, "key": ctx["current_dir"], "down": False})
                ctx["current_dir"] = None
            ctx["stats"]["walks"] += 1

        start_frame = ctx["frame"]
        ctx["frame"] += edge["cost"]
        why = f"{edge['kind']} {edge.get('dir') or ''} toward {subgoal_name}"
        why = " ".join(why.split())
        ctx["trace"].append({
            "kind": edge["kind"],
            "target": {"r": edge["to_cell"]["r"], "c": edge["to_cell"]["c"]},
            "why": why,
            "frame_range": [start_frame, ctx["frame"]],
            "edge_id": step_id(step["from_cell"], edge),
        })
        ctx["stats"]["steps"] += 1
        # Update ctx.state to the live end_state — the chain is exact.
        ctx["state"] = dict(edge["end_state"])
