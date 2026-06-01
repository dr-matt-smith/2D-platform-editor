"""Per-action simulator — the Python port of packages/agent/src/simAction.js.

The v21 source of truth for "what does this action actually do?". Mints a
scene through the physics adapter, forces the player to a given start state
(position + velocity + grounded flag), and steps scene.update(1/60) through
the action's recording. Returns where the player ended up, in sub-pixel
precision.

The graph builder / per-frame expander runs this once per (state, action)
candidate, so edges are physically valid by construction — no "agent thinks
vs engine says" drift.

State dicts use the keys {x, y, vx, vy, on_ground} — the exact kwargs of
PlaytestScene.set_player_state — so the next step's re-simulation can begin
EXACTLY where this one ended.
"""

import math

from .actions import action_cost, action_to_recording
from .constants import TILE

DT = 1 / 60


def make_sim_context(adapter, parsed, legend, tileset=None):
    """Build a reusable simulation context. The expander runs
    simulate_action_in_context repeatedly against this ONE context to avoid
    paying scene + to_world construction costs per action.

    Returns a dict {"scene", "fake_game", "adapter"}.
    """
    scene = adapter.make_scene(parsed, legend, tileset)
    return {"scene": scene, "fake_game": scene.game, "adapter": adapter}


def simulate_action_in_context(ctx, start_state, action, collect_trajectory=False):
    """Simulate `action` from `start_state` against an existing context.

    v25 M4: when `collect_trajectory` is set, the returned dict carries
    `trajectory: [{x, y}]` — the player's AABB top-left for every frame.
    """
    scene = ctx["scene"]
    scene.phase = "play"
    scene.score = 0
    for c in scene.coins:
        c.collected = False
    # v21: recording starts at frame=1 (matches the planner's settle
    # offset). The scene's _tick_scripted_input calls advance(0) on the
    # first update (no events fire — the player settles under gravity),
    # then advance(1) on the next update (press fires). Mirrors what the
    # live engine sees when the planner's recording is replayed.
    ctx["fake_game"].input = ctx["adapter"].make_scripted_input(action_to_recording(action, 1))
    scene.set_player_state(**start_state)
    # v21: reset BOTH the input-tick counter and the wall-clock accumulator
    # so successive simulations on the same context start fresh.
    scene.sim_frame = 0
    scene.sim_time = 0.0
    return _run_sim_loop(scene, ctx["fake_game"].input, action, collect_trajectory)


def simulate_action(adapter, parsed, legend, start_state, action, tileset=None):
    """Run one action and return the resulting state (single-shot)."""
    ctx = make_sim_context(adapter, parsed, legend, tileset)
    return simulate_action_in_context(ctx, start_state, action)


def _run_sim_loop(scene, inp, action, collect_trajectory=False):
    """Shared simulation loop. Advances scene.update(1/60) until the
    action's natural end.

    - Walks: run nominal_cost+1 frames so the release event at
      frame=nominal_cost fires and vx resets to 0 before we capture
      endVel. Reports cost=nominal_cost.
    - Air actions: run nominal_cost+30 frames; early-exit on landing
      (was_in_air -> on_ground transition). Reports cost = landing frame.
    """
    nominal_cost = action_cost(action)
    trajectory = [] if collect_trajectory else None
    is_air_action = action["kind"] in ("jump", "drop", "drop_release", "run_off")
    max_frames = nominal_cost + 30 if is_air_action else nominal_cost + 1
    was_in_air = not scene.player.on_ground
    collided = False

    # v28 M3 fixup: explicit advance BEFORE scene.update, matching the
    # live-engine loop. Idempotent vs the scene's _tick_scripted_input
    # (re-advancing to the same frame is a no-op in ScriptedInput) but it
    # avoids floating-point drift in sim_time's floor() lagging release
    # events by a frame.
    for frame in range(max_frames):
        if inp is not None and hasattr(inp, "advance"):
            inp.advance(frame)
        prev_x = scene.player.x
        scene.update(DT)

        if trajectory is not None:
            trajectory.append({"x": scene.player.x, "y": scene.player.y})

        if abs(scene.player.vx) > 0 and abs(scene.player.x - prev_x) < 0.1 and frame > 0:
            collided = True
        if scene.phase == "dead":
            return _finalise(scene, frame + 1, "dead", collided, trajectory)
        if scene.phase == "won":
            return _finalise(scene, frame + 1, "won", collided, trajectory)
        if not scene.player.on_ground:
            was_in_air = True
        elif was_in_air and is_air_action:
            return _finalise(scene, frame + 1, "ok", collided, trajectory)

    cost = max_frames if is_air_action else nominal_cost
    outcome = "ok" if scene.player.on_ground else "mid-air"
    return _finalise(scene, cost, outcome, collided, trajectory)


def _finalise(scene, cost, outcome, collided, trajectory=None):
    px = scene.player.x
    py = scene.player.y
    cx = px + scene.player.w / 2
    cy = py + scene.player.h / 2
    return {
        "outcome": outcome,
        "end_pos": {"x": px, "y": py},
        "end_cell": {"r": math.floor(cy / TILE), "c": math.floor(cx / TILE)},
        "end_vel": {"vx": scene.player.vx, "vy": scene.player.vy},
        # Full physics state at the end of the action; shape matches
        # set_player_state's kwargs so the next step's re-simulation can
        # begin EXACTLY where this one ended.
        "end_state": {
            "x": scene.player.x,
            "y": scene.player.y,
            "vx": scene.player.vx,
            "vy": scene.player.vy,
            "on_ground": scene.player.on_ground,
        },
        "trajectory": trajectory,
        "collided": collided,
        "cost": cost,
    }
