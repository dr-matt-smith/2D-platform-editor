"""Behavioural parity: the Python adapter must reproduce the JS engine
frame-for-frame on the golden vectors.

Each vector was produced by driving the REAL JS engine (jsAdapter) over
a case; here we drive the Python adapter (py_adapter) over the same
case and assert every per-frame player state matches. Regenerate the
vectors with:  deno task gen:golden
"""

import json
from pathlib import Path

import pytest

from agent_adapter import DEFAULT_LEGEND, py_adapter

VECTORS_PATH = Path(__file__).parent / "golden" / "vectors.json"
DT = 1 / 60
TOL = 1e-9  # IEEE-754 doubles + identical op order -> effectively exact


def _load():
    with open(VECTORS_PATH) as f:
        return json.load(f)


VECTORS = _load()
CASES = VECTORS["cases"]
LEGEND = VECTORS["roles"]  # {char: role} — exactly what the JS legend used


def _drive(parsed, recording, max_frames):
    """Drive the Python engine like sim.js: advance(f) then update(dt),
    capturing the full player state each frame. Stops on a terminal phase.
    """
    inp = py_adapter.make_scripted_input(recording)
    scene = py_adapter.make_scene(parsed, LEGEND)
    scene.game.input = inp
    frames = []
    for f in range(max_frames):
        inp.advance(f)
        scene.update(DT)
        frames.append(
            {
                "x": scene.player.x,
                "y": scene.player.y,
                "vx": scene.player.vx,
                "vy": scene.player.vy,
                "onGround": scene.player.on_ground,
                "phase": scene.phase,
                "score": scene.score,
            }
        )
        if scene.phase in ("won", "dead"):
            break
    return frames


def test_roles_match_default_legend():
    """Guard against legend drift: the role map the JS generator emitted
    must match the Python DEFAULT_LEGEND roles."""
    py_roles = {ch: role for ch, role in DEFAULT_LEGEND.items()}
    assert VECTORS["roles"] == py_roles


def test_dt_matches():
    assert VECTORS["dt"] == DT


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_case_parity(case):
    parsed = {"grid": case["grid"], "meta": case["meta"]}
    expected = case["frames"]
    actual = _drive(parsed, case["recording"], case["maxFrames"])

    assert len(actual) == len(expected), (
        f"{case['name']}: frame count diverged — "
        f"py {len(actual)} vs js {len(expected)}"
    )

    for i, (a, e) in enumerate(zip(actual, expected)):
        for k in ("x", "y", "vx", "vy"):
            assert abs(a[k] - e[k]) <= TOL, (
                f"{case['name']} frame {i}: {k} diverged — "
                f"py {a[k]!r} vs js {e[k]!r}"
            )
        assert a["onGround"] == e["onGround"], (
            f"{case['name']} frame {i}: onGround diverged — "
            f"py {a['onGround']} vs js {e['onGround']}"
        )
        assert a["phase"] == e["phase"], (
            f"{case['name']} frame {i}: phase diverged — "
            f"py {a['phase']} vs js {e['phase']}"
        )
        assert a["score"] == e["score"], (
            f"{case['name']} frame {i}: score diverged — "
            f"py {a['score']} vs js {e['score']}"
        )
