"""Contract + unit tests for agent_planner (no JS dependency)."""

import math

import pytest

from agent_adapter import DEFAULT_LEGEND, py_adapter
from agent_planner import (
    DEFAULT_CLUSTER_TOL,
    action_to_recording,
    assert_adapter,
    cluster_key,
    enumerate_actions,
    make_context_cache,
    nearby,
    plan,
    simulate,
)
from agent_planner import test_level as solve_level  # aliased: pytest collects test_*
from agent_planner.grid import glyph_role
from agent_planner.perframe import _js_round, discover_goals, expand_node


def _level(rows, **meta):
    width = max(len(r) for r in rows)
    return {"grid": rows, "meta": {"width": width, "height": len(rows), **meta}}


# --- action enumeration ---------------------------------------------------

def test_enumerate_actions_count():
    # 2 walks + 24 jumps + 2 drops + 8 drop_release + 10 run_off = 46.
    assert len(enumerate_actions()) == 46


def test_jump_recording_shape():
    rec = action_to_recording({"kind": "jump", "params": {"dir": "right", "hold_frames": 12}}, 1)
    assert {"frame": 1, "key": "right", "down": True} in rec
    assert {"frame": 1, "key": "space", "down": True} in rec
    assert {"frame": 2, "key": "space", "down": False} in rec
    assert {"frame": 13, "key": "right", "down": False} in rec


# --- adapter contract -----------------------------------------------------

def test_assert_adapter_requires_adapter():
    with pytest.raises(ValueError):
        assert_adapter(None, "test")


def test_assert_adapter_tile_mismatch():
    class Bad:
        TILE = 24
    with pytest.raises(ValueError):
        assert_adapter(Bad(), "test")


def test_plan_requires_adapter():
    with pytest.raises(ValueError):
        plan(_level(["#####", "#P.E#", "#####"]), DEFAULT_LEGEND)


# --- cluster key (JS Math.round semantics) --------------------------------

def test_js_round_half_up():
    # JS Math.round rounds .5 toward +Infinity; Python's round() does not.
    assert _js_round(0.5) == 1
    assert _js_round(2.5) == 3
    assert _js_round(-2.5) == -2  # floor(-2.5 + 0.5) = floor(-2.0) = -2


def test_cluster_key_buckets_nearby_states():
    a = {"x": 100.0, "y": 60.0, "vx": 0.0, "vy": 0.0, "on_ground": True}
    b = {"x": 100.2, "y": 60.1, "vx": 2.0, "vy": 1.0, "on_ground": True}
    assert nearby(a, b)
    c = {**a, "on_ground": False}
    assert not nearby(a, c)  # on_ground is strict


# --- goal discovery -------------------------------------------------------

def test_discover_goals_finds_spawn_pickups_exit():
    lvl = _level(["........", "#P.o.E.#", "########"])
    goals = discover_goals(lvl, DEFAULT_LEGEND)
    assert goals["start"] is not None
    assert len(goals["pickup_cells"]) == 1
    assert len(goals["exit_cells"]) == 1


# A tileset may draw levels with its own glyphs; only the roles matter
# (mirrors the remapped-legend tests in packages/agent/src/planner.test.ts).
REMAPPED = {".": "background", "=": "terrain", "~": "hazard", "@": "player", "X": "exit", "*": "pickup"}


def test_glyph_role_prefers_the_legend():
    assert glyph_role(REMAPPED, "=") == "terrain"
    assert glyph_role(REMAPPED, "#") is None  # not in this legend
    assert glyph_role(None, "#") == "terrain"  # classic glyphs without a legend
    assert glyph_role(None, "P") == "player"


def test_remapped_legend_level_solves():
    lvl = _level(["=========", "=@..*..X=", "========="], pickupRequired="all")
    result = solve_level(lvl, REMAPPED, adapter=py_adapter)
    assert result["ok"] is True
    sim = simulate(py_adapter, lvl, REMAPPED, recording=result["solution"]["recording"])
    assert sim["outcome"] == "won"
    assert sim["score"] == 1


# --- expand_node ----------------------------------------------------------

def test_expand_node_emits_walk_edge():
    lvl = _level(["........", "#P....E#", "########"], pickupRequired=0)
    cache = make_context_cache()
    start = {"x": 1 * 20, "y": 1 * 20, "vx": 0, "vy": 0, "on_ground": True}
    edges = expand_node(cache, lvl, DEFAULT_LEGEND, None, start,
                        adapter=py_adapter, exit_cells=[{"r": 1, "c": 6}])
    assert any(e["kind"] == "walk" and e["dir"] == "right" for e in edges)


# --- end-to-end solving ---------------------------------------------------

def test_test_level_solves_trivial():
    lvl = _level(["#####", "#P.E#", "#####"], pickupRequired=0)
    result = solve_level(lvl, DEFAULT_LEGEND, adapter=py_adapter)
    assert result["ok"] is True
    sim = simulate(py_adapter, lvl, DEFAULT_LEGEND, recording=result["solution"]["recording"])
    assert sim["outcome"] == "won"


def test_plan_unreachable_exit_returns_empty_trace():
    # Exit walled off behind solid terrain — no plan.
    lvl = _level(["#####", "#P#E#", "#####"], pickupRequired=0)
    result = plan(lvl, DEFAULT_LEGEND, adapter=py_adapter)
    assert result["trace"] == []
    assert result["recording"] == []


def test_bucket_backend_also_solves_trivial():
    lvl = _level(["#####", "#P.E#", "#####"], pickupRequired=0)
    result = plan(lvl, DEFAULT_LEGEND, adapter=py_adapter, planner="bucket")
    assert len(result["trace"]) >= 1
    sim = simulate(py_adapter, lvl, DEFAULT_LEGEND, recording=result["recording"])
    assert sim["outcome"] == "won"


def test_default_cluster_tol_is_a_mapping():
    assert set(DEFAULT_CLUSTER_TOL) == {"x", "y", "vx", "vy"}
    assert math.isclose(DEFAULT_CLUSTER_TOL["x"], 0.5)
