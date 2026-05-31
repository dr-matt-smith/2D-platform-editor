"""agent_adapter — a faithful Python port of the 2D level-designer's
JS physics engine, exposed through the same adapter contract the JS
agent consumes ({ TILE, make_scene, make_scripted_input }).

Standalone: no runtime coupling to the JS code. Behavioural parity with
the JS engine is validated by golden vectors generated from the real JS
engine (see tests/ + tools/gen_golden.mjs).
"""

from .adapter import PyAdapter, py_adapter
from .constants import DEFAULT_LEGEND, GRAVITY, JUMP_FORCE, SPEED, TILE, role_of
from .entities import Coin, Goal, Platform, Player, Spike, to_world
from .play_settings import meets_pickup_requirement
from .scene import PlaytestScene
from .scripted_input import ScriptedInput

__all__ = [
    "PyAdapter",
    "py_adapter",
    "PlaytestScene",
    "ScriptedInput",
    "to_world",
    "Player",
    "Platform",
    "Coin",
    "Spike",
    "Goal",
    "meets_pickup_requirement",
    "role_of",
    "DEFAULT_LEGEND",
    "TILE",
    "SPEED",
    "JUMP_FORCE",
    "GRAVITY",
]
