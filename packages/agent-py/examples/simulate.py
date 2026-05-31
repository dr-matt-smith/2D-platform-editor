"""Standalone smoke for the Python adapter.

    python3 packages/agent-py/examples/simulate.py

Builds a tiny level (a dict — no JS, no file parsing), drives the
Python physics adapter over a hand-authored recording, and prints the
outcome. Demonstrates the adapter is self-contained: a Python agent
would consume exactly this surface.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from agent_adapter import DEFAULT_LEGEND, py_adapter  # noqa: E402

DT = 1 / 60

# P at (1,1), exit E at (1,6), solid floor below. pickup-required none.
level = {
    "grid": [
        "########",
        "#P....E#",
        "########",
    ],
    "meta": {"width": 8, "height": 3, "pickupRequired": 0},
}

# Walk right until we win.
recording = [{"frame": 0, "key": "right", "down": True}]

inp = py_adapter.make_scripted_input(recording)
scene = py_adapter.make_scene(level, DEFAULT_LEGEND)
scene.game.input = inp

frame = 0
for frame in range(240):
    inp.advance(frame)
    scene.update(DT)
    if scene.phase != "play":
        break

print("Python adapter simulation:")
print(f"  outcome   : {scene.phase}")
print(f"  frames    : {frame + 1}")
print(f"  player x  : {scene.player.x:.1f}")
print(f"  score     : {scene.score}")

if scene.phase != "won":
    print("FAIL: expected to reach the exit.")
    sys.exit(1)
print("OK: Python adapter simulated to a win in isolation (no JS engine).")
