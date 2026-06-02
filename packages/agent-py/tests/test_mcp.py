"""Tests for the agent_mcp server.

Skipped automatically when the `mcp` SDK isn't installed (the core packages
are dependency-free; the MCP server is an optional extra). Install it with
`pip install -e ".[mcp]"` to exercise these.
"""

import asyncio
import json

import pytest

pytest.importorskip("mcp", reason="MCP server is an optional extra; pip install -e '.[mcp]'")

from agent_adapter import py_adapter  # noqa: E402
from agent_planner import simulate  # noqa: E402

import agent_mcp.server as srv  # noqa: E402

TRIVIAL = "# pickup-required: 0\n.........\n#P.....E#\n#########"
WITH_COIN = ".......\n#P.o.E#\n#######"
UNSOLVABLE = "# pickup-required: 0\n#####\n#P#E#\n#####"


def test_tools_registered():
    names = {t.name for t in asyncio.run(srv.mcp.list_tools())}
    assert names == {"describe_level_format", "solve_level", "plan_level", "simulate_recording"}


def test_describe_level_format_lists_glyphs():
    desc = srv.describe_level_format()
    assert "#" in desc["glyphs"] and "P" in desc["glyphs"] and "E" in desc["glyphs"]
    assert any("pickup-required" in k for k in desc["directives"])


def test_solve_level_returns_winning_recording():
    res = srv.solve_level(TRIVIAL)
    assert res["ok"] is True
    sol = res["solutions"][0]
    assert len(sol["recording"]) > 0
    assert sol["stats"]["frame"] > 0
    # The returned recording actually wins on the (independent) adapter.
    parsed = {"grid": res["level"]["grid"], "meta": {"width": res["level"]["width"], "height": res["level"]["height"]}}
    sim = simulate(py_adapter, parsed, srv._LEGEND, recording=sol["recording"])
    assert sim["outcome"] == "won"


def test_solve_level_collects_required_pickup():
    res = srv.solve_level(WITH_COIN)  # pickup-required defaults to 'all'
    assert res["ok"] is True
    assert res["solutions"][0]["stats"]["score"] >= 1


def test_pickup_required_override():
    # Override 'all' -> 0: the coin is no longer required, so a score-0
    # solution that beelines to the exit is acceptable.
    res = srv.solve_level(WITH_COIN, pickup_required="0")
    assert res["ok"] is True
    assert res["level"]["pickupRequired"] == 0


def test_plan_level_shape():
    res = srv.plan_level(TRIVIAL)
    assert res["solved"] is True
    assert len(res["recording"]) > 0
    assert all({"kind", "target", "why", "frame_range"} == set(t) for t in res["trace"])


def test_simulate_recording_roundtrips():
    sol = srv.solve_level(TRIVIAL)["solutions"][0]
    sim = srv.simulate_recording(TRIVIAL, sol["recording"])
    assert sim["outcome"] == "won"


def test_unsolvable_level_reports_failure():
    res = srv.solve_level(UNSOLVABLE)
    assert res["ok"] is False
    assert "reason" in res


def test_call_tool_wire_returns_json():
    """The protocol path (call_tool) returns JSON TextContent matching the
    direct call — validates schema + serialisation end to end."""
    content = asyncio.run(srv.mcp.call_tool("solve_level", {"level": TRIVIAL}))
    assert content and hasattr(content[0], "text")
    parsed = json.loads(content[0].text)
    assert parsed["ok"] is True
    assert parsed["solutions"][0]["recording"] == srv.solve_level(TRIVIAL)["solutions"][0]["recording"]
