"""v21 action taxonomy — the Python port of packages/agent/src/actions.js.

Each edge IS an action the player can physically execute. The kinds:

  walk{dir, cells}            — hold `dir` for cells * 5 frames.
  jump{dir, hold_frames}      — press space + hold `dir`, release `dir`
                                after `hold_frames` frames (release-mid-arc
                                caps horizontal travel for precise landings).
  drop{dir}                   — hold `dir` and walk off the ledge; fall.
  drop_release{dir, release_frame}
                              — hold `dir`, release at `release_frame` so
                                vx -> 0 mid-fall (more vertical descent).
  run_off{dir, walk_cells}    — walk N cells building vx, then carry into
                                the fall (one continuous held recording).
  wait{frames}                — release everything for `frames` frames.

Pure: no engine, no rendering. Actions are dicts: {"kind": str,
"params": dict}. Recording events are dicts: {"frame": int, "key": str,
"down": bool} — the shape ScriptedInput consumes.
"""

from .constants import GRAVITY, JUMP_FORCE

# Frames the player covers one cell of walking at SPEED=240, TILE=20.
# 20 / (240/60) = 5 frames per cell.
WALK_FRAMES_PER_CELL = 5

# Full jump-arc duration (2 * JUMP_FORCE / GRAVITY * 60), in frames.
# Used as the canonical jump cost; the actual landing may be sooner
# (higher platform) or later (lower platform) — sim resolves.
JUMP_ARC_FRAMES = round((2 * JUMP_FORCE) / GRAVITY * 60)

# Release-frame choices for the jump action — 12 evenly-spaced values
# spanning the arc. Cell-precision landings without blowing up the
# per-cell edge count.
RELEASE_FRAMES = [2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42]

# Buffer used for the drop action's nominal recording length. simAction
# reads its actual fall duration; this is just the "hold direction for at
# most this long" bound.
DROP_HOLD_FRAMES_BUDGET = 60

# v23 M6: explicit release frames for drop_release — analog of
# RELEASE_FRAMES for jumps. The frame at which the held direction key is
# RELEASED (vx -> 0). Pre-release: vx held; post-release: pure vertical fall.
DROP_RELEASE_FRAMES = [8, 16, 24, 32]

# v23 M6: walk-distance variants for run_off — how many cells to walk
# before letting gravity take over. Lengths 2..6 give five carry distances.
RUN_OFF_WALK_CELLS = [2, 3, 4, 5, 6]


def enumerate_actions():
    """Enumerate all candidate actions from a (grounded) cell.

    Does NOT filter for physical achievability — that's simAction's job.
    Per cell: 2 walks + 24 jumps (12 release-frames x 2 dirs) + 2 drops +
    8 drop_release + 10 run_off = 46 candidates. Single-cell walks; the
    planner's A* chains them for longer traverses.
    """
    actions = []
    for d in ("left", "right"):
        actions.append({"kind": "walk", "params": {"dir": d, "cells": 1}})
        for hold_frames in RELEASE_FRAMES:
            actions.append({"kind": "jump", "params": {"dir": d, "hold_frames": hold_frames}})
        actions.append({"kind": "drop", "params": {"dir": d}})
        for release_frame in DROP_RELEASE_FRAMES:
            actions.append({"kind": "drop_release", "params": {"dir": d, "release_frame": release_frame}})
        for walk_cells in RUN_OFF_WALK_CELLS:
            actions.append({"kind": "run_off", "params": {"dir": d, "walk_cells": walk_cells}})
    return actions


def action_cost(action):
    """The cost (in frames) of executing the action with held inputs.

    For drops the cost depends on landing distance and is computed by
    simAction; the value returned here is the maximum-hold window, used to
    size the recording.
    """
    kind = action["kind"]
    params = action["params"]
    if kind == "walk":
        return params["cells"] * WALK_FRAMES_PER_CELL
    if kind == "jump":
        return JUMP_ARC_FRAMES
    if kind == "drop":
        return DROP_HOLD_FRAMES_BUDGET
    if kind == "drop_release":
        return DROP_HOLD_FRAMES_BUDGET
    if kind == "run_off":
        return params["walk_cells"] * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET
    if kind == "wait":
        return params["frames"]
    raise ValueError(f"unknown action kind: {kind}")


def action_to_recording(action, frame_start=0):
    """Convert an action to a frame-indexed input-events list for
    ScriptedInput. `frame_start` is the absolute frame the action begins;
    events fire relative to it."""
    events = []
    kind = action["kind"]
    params = action["params"]
    if kind == "walk":
        end = frame_start + params["cells"] * WALK_FRAMES_PER_CELL
        events.append({"frame": frame_start, "key": params["dir"], "down": True})
        events.append({"frame": end, "key": params["dir"], "down": False})
    elif kind == "jump":
        events.append({"frame": frame_start, "key": params["dir"], "down": True})
        events.append({"frame": frame_start, "key": "space", "down": True})
        events.append({"frame": frame_start + 1, "key": "space", "down": False})
        events.append({"frame": frame_start + params["hold_frames"], "key": params["dir"], "down": False})
    elif kind == "drop":
        events.append({"frame": frame_start, "key": params["dir"], "down": True})
        events.append({"frame": frame_start + DROP_HOLD_FRAMES_BUDGET, "key": params["dir"], "down": False})
    elif kind == "drop_release":
        events.append({"frame": frame_start, "key": params["dir"], "down": True})
        events.append({"frame": frame_start + params["release_frame"], "key": params["dir"], "down": False})
    elif kind == "run_off":
        total = params["walk_cells"] * WALK_FRAMES_PER_CELL + DROP_HOLD_FRAMES_BUDGET
        events.append({"frame": frame_start, "key": params["dir"], "down": True})
        events.append({"frame": frame_start + total, "key": params["dir"], "down": False})
    elif kind == "wait":
        pass  # No key events; just elapsed time.
    else:
        raise ValueError(f"unknown action kind: {kind}")
    return events


def action_to_why(action, subgoal_name=""):
    """Format the action's `why:` string for the trace renderer."""
    kind = action["kind"]
    params = action["params"]
    sub = f" toward {subgoal_name}" if subgoal_name else ""
    if kind == "walk":
        noun = "cell" if params["cells"] == 1 else "cells"
        return f"walk {params['dir']} {params['cells']} {noun}{sub}"
    if kind == "jump":
        return f"jump {params['dir']} (release at frame {params['hold_frames']}){sub}"
    if kind == "drop":
        return f"drop off ledge {params['dir']}{sub}"
    if kind == "drop_release":
        return f"drop {params['dir']} (release at frame {params['release_frame']}){sub}"
    if kind == "run_off":
        noun = "cell" if params["walk_cells"] == 1 else "cells"
        return f"walk {params['dir']} {params['walk_cells']} {noun} then carry into fall{sub}"
    if kind == "wait":
        return f"wait {params['frames']} frame{'' if params['frames'] == 1 else 's'}"
    return f"{kind}{sub}"
