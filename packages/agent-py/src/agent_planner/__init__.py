"""agent_planner — the 2D level-designer's planning agent, in pure Python.

A faithful port of the JS agent (packages/agent/src/*). Given a parsed
level, it searches for an input recording that solves it (collect required
pickups, reach the exit) and returns up to five distinct solutions, each
with an explainable trace. The default backend is the v28 per-frame
trajectory planner: A* nodes carry the full continuous-physics state and
edges are produced on the fly by simulating actions, so the recording it
emits replays byte-identically on the live engine.

Engine-agnostic: every entry that simulates physics takes the physics
adapter via the `adapter` keyword. The agent's ONLY engine dependency is
that adapter object — pass `agent_adapter.py_adapter` (the standalone
Python physics port). See README.md for the adapter contract.

    from agent_adapter import py_adapter, DEFAULT_LEGEND
    from agent_planner import test_level

    parsed = {"grid": ["#####", "#P.E#", "#####"], "meta": {"width": 5, "height": 3}}
    result = test_level(parsed, DEFAULT_LEGEND, adapter=py_adapter)
    # result["ok"] is True; result["solution"]["recording"] is the winning input.
"""

from .actions import (
    DROP_HOLD_FRAMES_BUDGET,
    WALK_FRAMES_PER_CELL,
    action_to_recording,
    action_to_why,
    enumerate_actions,
)
from .constants import GRAVITY, JUMP_FORCE, SPEED, TILE
from .level import parse
from .grid import (
    JUMP_MAX_HORIZ_CELLS,
    JUMP_MAX_VERT_CELLS,
    VX_BUCKETS,
    X_OFFSET_BUCKETS,
    build_nav_graph,
    bucket_centre_x,
    cell_key,
    find_overlapping_exit,
    parse_state_key,
    state_key,
    vx_bucket_of,
    x_offset_bucket_of,
)
from .perframe import (
    DEFAULT_CLUSTER_TOL,
    a_star_per_frame,
    cluster_key,
    discover_goals,
    expand_node,
    make_context_cache,
    nearby,
    plan_per_frame,
)
from .planner import a_star, assert_adapter, plan, replan
from .runner import test_level
from .sim import simulate
from .sim_action import make_sim_context, simulate_action, simulate_action_in_context

__all__ = [
    # top-level entries
    "test_level",
    "plan",
    "replan",
    "simulate",
    "assert_adapter",
    "parse",
    # per-frame planner
    "plan_per_frame",
    "a_star_per_frame",
    "expand_node",
    "make_context_cache",
    "cluster_key",
    "nearby",
    "discover_goals",
    "DEFAULT_CLUSTER_TOL",
    # bucket nav-graph
    "build_nav_graph",
    "a_star",
    "state_key",
    "cell_key",
    "parse_state_key",
    "vx_bucket_of",
    "x_offset_bucket_of",
    "bucket_centre_x",
    "find_overlapping_exit",
    "VX_BUCKETS",
    "X_OFFSET_BUCKETS",
    "JUMP_MAX_HORIZ_CELLS",
    "JUMP_MAX_VERT_CELLS",
    # actions
    "enumerate_actions",
    "action_to_recording",
    "action_to_why",
    "WALK_FRAMES_PER_CELL",
    "DROP_HOLD_FRAMES_BUDGET",
    # sim-action
    "make_sim_context",
    "simulate_action",
    "simulate_action_in_context",
    # constants
    "TILE",
    "SPEED",
    "JUMP_FORCE",
    "GRAVITY",
]
