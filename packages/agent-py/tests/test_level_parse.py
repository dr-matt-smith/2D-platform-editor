"""The Python level parser reproduces the JS parser's (grid, width, height,
pickupRequired) on the golden levels.

The golden vectors store each agent case's grid + trimmed meta (produced by
the JS parser in tools/gen_golden.ts). Re-parsing the same level text here
must yield an identical grid + meta — otherwise the planner would discretise
a different level than the JS agent did.
"""

import json
from pathlib import Path

import pytest

from agent_planner import parse

GOLDEN = json.loads((Path(__file__).parent / "golden" / "vectors.json").read_text())
AGENT_CASES = [c for c in GOLDEN["cases"] if c["kind"] == "agent"]

# Repo-root level files matching each agent case (name == agent_plan_<file>).
REPO = Path(__file__).resolve().parents[3]
LEVELS_DIR = REPO / "public" / "data" / "levels"


@pytest.mark.parametrize("case", AGENT_CASES, ids=[c["name"] for c in AGENT_CASES])
def test_parse_matches_golden_grid_and_meta(case):
    file = case["name"].replace("agent_plan_", "") + ".txt"
    path = LEVELS_DIR / file
    if not path.exists():
        pytest.skip(f"level file {file} not present")
    parsed = parse(path.read_text())
    assert parsed["grid"] == case["grid"]
    assert parsed["meta"]["width"] == case["meta"]["width"]
    assert parsed["meta"]["height"] == case["meta"]["height"]
    assert parsed["meta"]["pickupRequired"] == case["meta"]["pickupRequired"]


def test_parse_pickup_required_directive():
    p = parse("# pickup-required: 3\n#P.E#")
    assert p["meta"]["pickupRequired"] == 3
    assert parse("#P.E#")["meta"]["pickupRequired"] == "all"


def test_parse_pads_rows_to_width():
    p = parse("####\n#P\n####")
    assert all(len(row) == 4 for row in p["grid"])
    assert p["grid"][1] == "#P.."
