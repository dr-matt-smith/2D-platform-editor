"""Planner — the Python port of packages/agent/src/planner.js.

Builds a nav-graph (via grid.py), then runs A* between consecutive goals
(pickups, exit) to produce trace + recording + stats. The default backend
delegates to the per-frame trajectory planner (perframe.py); the bucket-
aware A* here is kept callable for diagnostics + fallback.
"""

import itertools
import math

from .constants import TILE
from .grid import build_nav_graph, cell_key, state_key, vx_bucket_of
from .perframe import plan_per_frame
from .sim_action import make_sim_context, simulate_action_in_context


def assert_adapter(adapter, where):
    """v29 M3: physics-adapter contract check. The tile size the agent
    discretises the level with MUST match the engine the adapter wraps. A
    misconfigured adapter would silently produce edges the live engine never
    reproduces. Throw at the public boundary so the failure is loud."""
    if not adapter:
        raise ValueError(f"{where}: adapter is required (v29). Pass adapter=py_adapter.")
    if adapter.TILE != TILE:
        raise ValueError(
            f"{where}: adapter.TILE ({adapter.TILE}) does not match the agent's TILE ({TILE}). "
            "The adapter must wrap the same engine physics the agent was built against."
        )


# ---- A* over the nav-graph -----------------------------------------------

def _heuristic(from_r, from_c, to_r, to_c):
    """Manhattan-cell heuristic, weighted by the walk cost."""
    return (abs(from_r - to_r) + abs(from_c - to_c)) * 5


def _lowest_f(open_set, f_score):
    best = None
    best_f = math.inf
    for k in open_set:
        f = f_score.get(k, math.inf)
        if f < best_f:
            best_f = f
            best = k
    return best


def a_star(graph, frm, to, blocked=None):
    """A* on the nav-graph. `frm` is a state_key; `to` is a CELL key —
    succeeds when any state_key at that cell is reached. Returns a list of
    {"from", "edge"} steps, or None if unreachable."""
    blocked = blocked or set()
    if frm not in graph["nodes"]:
        return None
    goal_cell_prefix = to + ","

    def matches_goal(k):
        return k == to or k.startswith(goal_cell_prefix)

    if matches_goal(frm):
        return []

    fr, fc = (int(v) for v in frm.split(",")[:2])
    tr, tc = (int(v) for v in to.split(","))

    # Insertion-ordered dict as an ordered set (JS Set iteration order).
    open_set = {frm: None}
    came_from = {}
    g_score = {frm: 0}
    f_score = {frm: _heuristic(fr, fc, tr, tc)}

    while open_set:
        current = _lowest_f(open_set, f_score)
        if matches_goal(current):
            path = []
            node = current
            while node in came_from:
                entry = came_from[node]
                path.insert(0, {"from": entry["from"], "edge": entry["edge"]})
                node = entry["from"]
            return path
        del open_set[current]
        edges = graph["edges"].get(current, [])
        for edge in edges:
            edge_id = f"{current}>{edge['to']}:{edge['kind']}"
            if edge_id in blocked:
                continue
            tentative = g_score.get(current, math.inf) + edge["cost"]
            if tentative < g_score.get(edge["to"], math.inf):
                came_from[edge["to"]] = {"from": current, "edge": edge}
                g_score[edge["to"]] = tentative
                er, ec = (int(v) for v in edge["to"].split(",")[:2])
                f_score[edge["to"]] = tentative + _heuristic(er, ec, tr, tc)
                open_set[edge["to"]] = None
    return None


# ---- Goal queue ----------------------------------------------------------

def _resolve_goals(graph, required_pickups):
    """Resolve the goal queue for a level given its pickup-required setting.
    Returns an ordered list of "r,c" goal keys, ending in an exit cell."""
    exit_key = cell_key(graph["exit_cells"][0]["r"], graph["exit_cells"][0]["c"]) if graph["exit_cells"] else None
    if not exit_key:
        return []

    total = len(graph["pickup_cells"])
    if required_pickups == "all" or required_pickups is None:
        need = total
    elif isinstance(required_pickups, (int, float)) and not isinstance(required_pickups, bool) and required_pickups > 0:
        need = min(int(required_pickups), total)
    else:
        need = 0

    if need == 0:
        return [exit_key]

    start_cell = graph["start"]
    if not start_cell:
        return [exit_key]
    start_key = state_key(start_cell["r"], start_cell["c"], 0, "L")
    all_keys = [cell_key(p["r"], p["c"]) for p in graph["pickup_cells"]]

    reachable = [k for k in all_keys if a_star(graph, start_key, k) is not None]
    if len(reachable) == 0:
        return [exit_key]

    ordering = _pick_best_ordering(graph, start_key, reachable, need, exit_key)
    return [*ordering, exit_key]


def _pick_best_ordering(graph, start_key, pickups, need, exit_key):
    M = len(pickups)
    if need >= M:
        return _best_order_of_subset(graph, start_key, pickups, exit_key)
    best = None
    best_cost = math.inf
    for subset in itertools.combinations(pickups, need):
        order = _best_order_of_subset(graph, start_key, list(subset), exit_key)
        cost = _total_chain_cost(graph, start_key, [*order, exit_key])
        if cost < best_cost:
            best_cost = cost
            best = order
    return best if best is not None else []


def _best_order_of_subset(graph, start_key, subset, exit_key):
    K = len(subset)
    if K == 0:
        return []
    if K == 1:
        return [subset[0]]
    if K <= 4:
        best = None
        best_cost = math.inf
        for perm in itertools.permutations(subset):
            cost = _total_chain_cost(graph, start_key, [*perm, exit_key])
            if cost < best_cost:
                best_cost = cost
                best = list(perm)
        return best if best is not None else subset
    greedy = _greedy_nearest(graph, start_key, subset, exit_key)
    return _two_opt_improve(graph, start_key, greedy, exit_key)


def _greedy_nearest(graph, start_key, pickups, exit_key):
    cur = start_key
    remaining = list(pickups)
    order = []
    while remaining:
        best_key = None
        best_cost = math.inf
        for c in remaining:
            path = a_star(graph, cur, c)
            if path is None:
                continue
            cost = sum(step["edge"]["cost"] for step in path)
            if cost < best_cost:
                best_cost = cost
                best_key = c
        if not best_key:
            break
        order.append(best_key)
        cur = _cell_to_bucket0(best_key)
        remaining.remove(best_key)
    return order


def _cell_to_bucket0(k):
    """cell_key "r,c" -> state_key "r,c,0,L"."""
    return f"{k},0,L" if len(k.split(",")) == 2 else k


def _two_opt_improve(graph, start_key, order, exit_key):
    best = list(order)
    best_cost = _total_chain_cost(graph, start_key, [*best, exit_key])
    improved = True
    it = 0
    MAX_ITER = 50
    while improved and it < MAX_ITER:
        improved = False
        it += 1
        for i in range(len(best) - 1):
            for j in range(i + 1, len(best)):
                candidate = list(best)
                candidate[i], candidate[j] = candidate[j], candidate[i]
                cost = _total_chain_cost(graph, start_key, [*candidate, exit_key])
                if cost < best_cost:
                    best_cost = cost
                    best = candidate
                    improved = True
    return best


def _total_chain_cost(graph, start_key, chain):
    cur = start_key
    total = 0
    for g in chain:
        path = a_star(graph, cur, g)
        if path is None:
            return math.inf
        total += sum(step["edge"]["cost"] for step in path)
        cur = _cell_to_bucket0(g)
    return total


# ---- Trace + recording emission ------------------------------------------

def _why_for_edge(edge, subgoal_name):
    if edge["kind"] == "walk":
        return f"walk {edge['dir']} toward {subgoal_name}"
    if edge["kind"] == "jump":
        if edge["dir"] == "still":
            return f"jump up toward {subgoal_name}"
        return f"jump {edge['dir']} toward {subgoal_name}"
    if edge["kind"] == "drop":
        return f"drop {edge['dir']} toward {subgoal_name}"
    return f"{edge['kind']} toward {subgoal_name}"


def _emit_leg_inputs(steps, subgoal_name, ctx):
    for step in steps:
        edge = step["edge"]
        tr, tc = (int(v) for v in edge["to"].split(",")[:2])
        d = edge["dir"]

        if d in ("left", "right"):
            if ctx["current_dir"] != d:
                if ctx["current_dir"]:
                    ctx["recording"].append({"frame": ctx["frame"], "key": ctx["current_dir"], "down": False})
                ctx["recording"].append({"frame": ctx["frame"], "key": d, "down": True})
                ctx["current_dir"] = d

        params = (edge.get("action") or {}).get("params", {})
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
            ctx["stats"]["drops"] += 1
        elif edge["kind"] == "drop_release":
            rf = params.get("release_frame")
            if rf is not None and rf < edge["cost"] and ctx["current_dir"]:
                ctx["recording"].append({"frame": ctx["frame"] + rf, "key": ctx["current_dir"], "down": False})
                ctx["current_dir"] = None
            ctx["stats"]["drops"] += 1
        elif edge["kind"] == "run_off":
            ctx["stats"]["walks"] += 1

        # v25 M2: re-simulate the action from the previous step's actual
        # end_state so the cost we advance ctx.frame by matches what the
        # live engine will produce. Falls back to the build-time edge cost
        # when sim_context is unavailable (levels with no spawn).
        step_cost = edge["cost"]
        if ctx["sim_context"] and ctx["prev_end_state"] and edge.get("action"):
            re_sim = simulate_action_in_context(ctx["sim_context"], ctx["prev_end_state"], edge["action"])
            step_cost = re_sim["cost"]
            ctx["prev_end_state"] = re_sim["end_state"]

        start_frame = ctx["frame"]
        ctx["frame"] += step_cost
        ctx["trace"].append({
            "kind": edge["kind"],
            "target": {"r": tr, "c": tc},
            "why": _why_for_edge(edge, subgoal_name),
            "frame_range": [start_frame, ctx["frame"]],
            "edge_id": f"{step['from']}>{edge['to']}:{edge['kind']}",
        })
        ctx["stats"]["steps"] += 1
        ctx["position"] = edge["to"]


# ---- Public plan + replan ------------------------------------------------

def plan(parsed, legend, adapter=None, tileset=None, blocked=None, planner="perframe", tol=None, node_cap=None):
    """Plan a path through the level. Never returns None; if the exit is
    unreachable the trace is empty and recording is []."""
    assert_adapter(adapter, "plan()")
    blocked = blocked if isinstance(blocked, set) else set()

    backend = planner or "perframe"
    if backend == "perframe":
        return plan_per_frame(parsed, legend, tileset, adapter=adapter, tol=tol, node_cap=node_cap,
                              blocked=blocked)

    graph = build_nav_graph(adapter, parsed, legend, tileset)
    if not graph["start"] or len(graph["exit_cells"]) == 0:
        return _empty_plan(graph)

    required_pickups = (parsed.get("meta") or {}).get("pickupRequired", "all")
    goals = _resolve_goals(graph, required_pickups)
    if len(goals) == 0:
        return _empty_plan(graph)

    try:
        sim_context = make_sim_context(adapter, parsed, legend, tileset)
    except Exception:
        sim_context = None

    ctx = {
        "recording": [],
        "trace": [],
        "stats": {"steps": 0, "jumps": 0, "walks": 0, "drops": 0},
        "frame": 1,
        "current_dir": None,
        "position": state_key(graph["start"]["r"], graph["start"]["c"], 0, "L"),
        "sim_context": sim_context,
        "prev_end_state": (
            {"x": graph["start"]["c"] * TILE, "y": graph["start"]["r"] * TILE,
             "vx": 0, "vy": 0, "on_ground": True}
            if sim_context else None
        ),
    }
    unreachable = []

    for goal in goals:
        gr, gc = (int(v) for v in goal.split(","))
        subgoal_name = _describe_goal(graph, goal)
        remaining = a_star(graph, ctx["position"], goal, blocked)
        if remaining is None:
            is_exit = any(e["r"] == gr and e["c"] == gc for e in graph["exit_cells"])
            if is_exit:
                return {
                    "trace": ctx["trace"],
                    "recording": _finalise_recording(ctx),
                    "stats": ctx["stats"],
                    "graph": graph,
                    "goals": goals,
                    "unreachable": [*unreachable, {"r": gr, "c": gc, "kind": "exit"}],
                }
            unreachable.append({"r": gr, "c": gc, "kind": "pickup"})
            continue
        replan_budget = 48
        while remaining and replan_budget > 0:
            replan_budget -= 1
            _emit_leg_inputs([remaining[0]], subgoal_name, ctx)
            remaining = remaining[1:]
            if not remaining or not ctx["prev_end_state"]:
                continue
            live_r = math.floor((ctx["prev_end_state"]["y"] + TILE / 2) / TILE)
            live_c = math.floor((ctx["prev_end_state"]["x"] + TILE / 2) / TILE)
            live_vx_b = vx_bucket_of(ctx["prev_end_state"]["vx"])
            sub = ((ctx["prev_end_state"]["x"] % TILE) + TILE) % TILE
            live_xob = "L"
            if TILE / 3 <= sub < (2 * TILE) / 3:
                live_xob = "C"
            elif sub >= (2 * TILE) / 3:
                live_xob = "R"
            live_key = state_key(live_r, live_c, live_vx_b, live_xob)
            if remaining[0]["from"] == live_key:
                continue
            if live_key not in graph["nodes"]:
                continue
            ctx["position"] = live_key
            fresh = a_star(graph, live_key, goal, blocked)
            if fresh is not None:
                remaining = fresh

    return {
        "trace": ctx["trace"],
        "recording": _finalise_recording(ctx),
        "stats": ctx["stats"],
        "graph": graph,
        "goals": goals,
        "unreachable": unreachable,
    }


def _empty_plan(graph):
    return {
        "trace": [],
        "recording": [],
        "stats": {"steps": 0, "jumps": 0, "walks": 0, "drops": 0},
        "graph": graph,
        "goals": [],
        "unreachable": [],
    }


def _finalise_recording(ctx):
    if ctx["current_dir"]:
        ctx["recording"].append({"frame": ctx["frame"], "key": ctx["current_dir"], "down": False})
        ctx["current_dir"] = None
    return ctx["recording"]


def _describe_goal(graph, key):
    r, c = (int(v) for v in key.split(","))
    if any(e["r"] == r and e["c"] == c for e in graph["exit_cells"]):
        return f"exit at ({c},{r})"
    pickup_idx = next((i for i, p in enumerate(graph["pickup_cells"]) if p["r"] == r and p["c"] == c), -1)
    if pickup_idx >= 0:
        return f"pickup #{pickup_idx + 1} at ({c},{r})"
    return f"({c},{r})"


def replan(previous, sim, parsed, legend, adapter=None, tileset=None, planner="perframe", tol=None, node_cap=None,
           blocked=None):
    """Replan after a failed simulation. Finds the trace entry whose
    frame_range brackets the failure frame, marks its edge blocked (on top
    of any `blocked`), and re-runs plan with the augmented block set.
    Returns a fresh plan or None if no recoverable edge."""
    if not previous or not previous["trace"]:
        return None
    fail_entry = next(
        (e for e in previous["trace"] if e["frame_range"][0] <= sim["frame"] < e["frame_range"][1]),
        None,
    )
    if not fail_entry:
        fail_entry = previous["trace"][-1]
    blocked = set(blocked or ()) | {fail_entry["edge_id"]}
    return plan(parsed, legend, adapter=adapter, tileset=tileset, blocked=blocked,
                planner=planner, tol=tol, node_cap=node_cap)
