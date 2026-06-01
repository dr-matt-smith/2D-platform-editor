"""Standalone smoke for the Python PLANNER (agent_planner).

    python3 packages/agent-py/examples/solve.py

Solves a level end-to-end in pure Python: the planner searches for an
input recording, then we replay it through the Python adapter to confirm
the win. No JS, no file parsing, no engine coupling beyond the adapter
object. Demonstrates the agent's only engine dependency is `py_adapter`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from agent_adapter import DEFAULT_LEGEND, py_adapter  # noqa: E402
from agent_planner import simulate, test_level  # noqa: E402

# Two platforms: collect the coin on the upper ledge, then drop off the
# right edge down to the exit on the lower floor. Requires a pickup + a
# drop — the planner searches the action graph for the sequence.
level = {
    "grid": [
        "............",
        "#P.o...#....",
        "####...#....",
        "#......E....",
        "############",
    ],
    "meta": {"width": 12, "height": 5, "pickupRequired": "all"},
}

result = test_level(level, DEFAULT_LEGEND, adapter=py_adapter)

print("Python planner solve:")
if not result["ok"]:
    print("  FAIL: no solution found.")
    print(f"  last_sim: {result.get('last_sim')}")
    sys.exit(1)

sol = result["solution"]
print(f"  solutions : {len(result['solutions'])}")
print(f"  steps     : {sol['stats']['steps']}  "
      f"(walks {sol['stats']['walks']}, jumps {sol['stats']['jumps']}, drops {sol['stats']['drops']})")
print(f"  win frame : {sol['stats']['frame']}")
print(f"  score     : {sol['stats']['score']}")
print(f"  events    : {len(sol['recording'])} input events")

# Independently replay the emitted recording to prove it wins.
verify = simulate(py_adapter, level, DEFAULT_LEGEND, recording=sol["recording"])
if verify["outcome"] != "won":
    print(f"  FAIL: replay did not win (got {verify['outcome']}).")
    sys.exit(1)
print("OK: planner solved the level and the recording replays to a win (pure Python).")
