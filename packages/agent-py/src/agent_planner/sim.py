"""Headless simulator — the Python port of packages/agent/src/sim.js.

Runs scene.update(1/60) in a tight loop with no rendering. Used by the
runner to validate candidate plans and by tests to assert "this input
sequence wins this level". Mints the scene through the injected physics
adapter; swaps in the recording's input, then advances scene.update(dt)
until scene.phase transitions or the max_frames budget is exhausted.
"""

DEFAULT_DT = 1 / 60
DEFAULT_MAX_FRAMES = 600  # 10 seconds of in-game time at 60 fps


def simulate(adapter, parsed, legend, recording=None, tileset=None, dt=DEFAULT_DT, max_frames=DEFAULT_MAX_FRAMES):
    """Run a single headless simulation.

    Returns a dict {"outcome": 'won'|'dead'|'timeout', "frame", "score",
    "pos": {"x", "y"}}.
    """
    inp = adapter.make_scripted_input(recording or [])
    scene = adapter.make_scene(parsed, legend, tileset)
    scene.game.input = inp

    for frame in range(max_frames):
        inp.advance(frame)
        scene.update(dt)
        # scene.update may transition phase the same tick it's read.
        if scene.phase == "won":
            return {
                "outcome": "won",
                "frame": frame,
                "score": scene.score,
                "pos": {"x": scene.player.x, "y": scene.player.y},
            }
        if scene.phase == "dead":
            return {
                "outcome": "dead",
                "frame": frame,
                "score": scene.score,
                "pos": {"x": scene.player.x, "y": scene.player.y},
            }
    return {
        "outcome": "timeout",
        "frame": max_frames,
        "score": scene.score,
        "pos": {"x": scene.player.x, "y": scene.player.y},
    }
