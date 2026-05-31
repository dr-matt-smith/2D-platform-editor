"""The Python physics adapter — the mirror of src/agent-adapter.js
(jsAdapter). Same contract: { TILE, make_scene, make_scripted_input }.

A Python port of the planning agent would depend on ONLY this object,
exactly as the JS agent depends only on jsAdapter. make_scene returns
an already-entered scene whose `game` is a mutable holder so the caller
can swap `game.input` per simulated action.
"""

from .constants import DEFAULT_LEGEND, TILE
from .scene import PlaytestScene
from .scripted_input import ScriptedInput


class _Assets:
    def play(self, name=None, opts=None):
        # No-op — the simulator runs thousands of times during planning;
        # emitting sounds would be expensive and unwanted.
        pass


class _Game:
    """Mutable { input, assets } holder. The agent swaps `input` per
    simulated action; the scene reads `game.input` dynamically."""

    __slots__ = ("input", "assets")

    def __init__(self, input, assets):
        self.input = input
        self.assets = assets


class PyAdapter:
    TILE = TILE

    def make_scene(self, parsed, legend=None, tileset=None):
        game = _Game(ScriptedInput([]), _Assets())
        scene = PlaytestScene(game, parsed, legend or DEFAULT_LEGEND, tileset)
        scene.enter()  # restart(): builds entities, spawn-settles, phase='play'
        return scene

    def make_scripted_input(self, recording=None):
        return ScriptedInput(recording or [])


# Module-level singleton, mirroring the JS `jsAdapter` export.
py_adapter = PyAdapter()
