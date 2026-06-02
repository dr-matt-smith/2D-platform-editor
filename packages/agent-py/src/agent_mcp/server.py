"""The MCP server definition — tools that expose the Python planning agent.

Every tool takes a level as the editor's plain-text format (paste a level
file's contents) and returns JSON-serialisable results. The planner runs
fully in-process against the standalone Python physics adapter; the
recordings it returns replay byte-identically on the live JS engine.
"""

from mcp.server.fastmcp import FastMCP

from agent_adapter import DEFAULT_LEGEND, py_adapter
from agent_planner import parse, plan, simulate, test_level

mcp = FastMCP("agent-py")

# The DEFAULT (Dirt) glyph legend the planner discretises against. Levels
# authored with a custom tileset still parse the same glyph roles.
_LEGEND = DEFAULT_LEGEND

_GLYPHS = {
    "#": "terrain (solid floor/wall)",
    "P": "player spawn",
    "E": "exit (reach to win)",
    "o": "pickup / coin",
    "^": "hazard / spike (touch = death)",
    ".": "background (empty, passable)",
}


def _parse_level(level_text, pickup_required=None):
    """Parse level text; apply an optional pickup_required override
    ('all' | 0 | positive int)."""
    parsed = parse(level_text)
    if pickup_required is not None:
        if isinstance(pickup_required, str) and pickup_required.lower() == "all":
            parsed["meta"]["pickupRequired"] = "all"
        else:
            parsed["meta"]["pickupRequired"] = int(pickup_required)
    return parsed


def _level_summary(parsed):
    return {
        "width": parsed["meta"]["width"],
        "height": parsed["meta"]["height"],
        "pickupRequired": parsed["meta"]["pickupRequired"],
        "grid": parsed["grid"],
    }


@mcp.tool()
def describe_level_format() -> dict:
    """Describe the level text format and glyph legend so a caller can
    author a level the planner understands.

    Returns the glyph->meaning map and the supported header directives.
    Levels are plain text: an optional header of `# key: value` lines, then
    the grid rows (one string per row). Example:

        # pickup-required: 0
        .........
        #P.....E#
        #########
    """
    return {
        "glyphs": _GLYPHS,
        "directives": {
            "# pickup-required: <all|0|N>": "how many pickups must be collected to win (default: all)",
            "# size: WxH": "declared grid size; rows are right-padded with '.' to width W",
            "# name: <text>": "level name (ignored by the planner)",
        },
        "notes": [
            "Rows shorter than the grid width are right-padded with '.'.",
            "The player spawns at 'P' and falls until it lands on terrain.",
            "Exactly one 'P' and at least one 'E' are needed for a solve.",
        ],
        "example": "# pickup-required: 0\n.........\n#P.....E#\n#########",
    }


@mcp.tool()
def solve_level(level: str, pickup_required: str | None = None, max_runtime_ms: int = 5000) -> dict:
    """Solve a level: search for input recordings that win it.

    `level` is the level text (see describe_level_format). `pickup_required`
    optionally overrides the level's own directive ('all', '0', or a number
    as a string). `max_runtime_ms` bounds the search.

    Returns {"ok": true, "level": {...}, "solutions": [...]} on success —
    each solution carries the winning `recording` (a list of
    {frame, key, down} input events that replay byte-identically on the live
    engine), `stats` (steps/walks/jumps/drops/frame/score), and a
    human-readable `trace`. On failure returns {"ok": false, "reason", ...}.
    """
    parsed = _parse_level(level, pickup_required)
    result = test_level(parsed, _LEGEND, adapter=py_adapter, max_runtime_ms=max_runtime_ms)
    if not result["ok"]:
        last_sim = result.get("last_sim")
        return {
            "ok": False,
            "level": _level_summary(parsed),
            "reason": result.get("reason") or (
                "no winning recording found within the time budget"
                if last_sim else "no plan: exit or required pickups unreachable from spawn"
            ),
            "last_sim": last_sim,
            "attempts": result.get("attempts", 0),
        }
    solutions = []
    for s in result["solutions"]:
        solutions.append({
            "recording": s["recording"],
            "stats": s["stats"],
            "trace": [_trace_entry(t) for t in s["plan"]["trace"]],
            "unreachable": s["unreachable"],
        })
    return {"ok": True, "level": _level_summary(parsed), "solutions": solutions}


@mcp.tool()
def plan_level(level: str, pickup_required: str | None = None) -> dict:
    """Produce a single plan for a level (one search, no replan loop).

    Lighter than solve_level — returns the first recording the planner finds
    plus its explainable trace and any unreachable goals. Use solve_level
    when you want verified, multiple, shortest-first solutions.

    Returns {"level", "recording", "stats", "trace", "goals", "unreachable",
    "solved": bool}. `solved` is false when the exit was unreachable (empty
    recording).
    """
    parsed = _parse_level(level, pickup_required)
    result = plan(parsed, _LEGEND, adapter=py_adapter)
    return {
        "level": _level_summary(parsed),
        "solved": len(result["recording"]) > 0,
        "recording": result["recording"],
        "stats": result["stats"],
        "trace": [_trace_entry(t) for t in result["trace"]],
        "goals": result["goals"],
        "unreachable": result["unreachable"],
    }


@mcp.tool()
def simulate_recording(level: str, recording: list[dict], pickup_required: str | None = None,
                       max_frames: int = 2400) -> dict:
    """Replay a recording on a level and report the outcome.

    `recording` is a list of {frame, key, down} input events (keys: 'left',
    'right', 'space'). Use this to verify a recording you constructed or
    edited still wins. Returns {"outcome": 'won'|'dead'|'timeout', "frame",
    "score", "pos": {x, y}}.
    """
    parsed = _parse_level(level, pickup_required)
    sim = simulate(py_adapter, parsed, _LEGEND, recording=recording, max_frames=max_frames)
    return {"level": _level_summary(parsed), **sim}


def _trace_entry(t):
    """Flatten a planner trace entry for the wire (drop the internal
    edge_id; keep the human-readable why + target + frame range)."""
    return {
        "kind": t["kind"],
        "target": t["target"],
        "why": t["why"],
        "frame_range": t["frame_range"],
    }
