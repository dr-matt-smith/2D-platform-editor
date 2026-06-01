"""The planner's local engine-physics constants — the Python mirror of
packages/agent/src/constants.js.

The JS agent deliberately owns a COPY of the engine's physics constants
rather than importing them from the engine: a planner package can't reach
into the editor's vendored engine without re-coupling them. The Python
port keeps the same discipline — `agent_planner` owns these, and they are
verified against the adapter's TILE at plan()/test_level() entry
(assert_adapter in planner.py). A Python adapter that ships a different
TILE throws loudly at the boundary rather than silently emitting edges the
live engine never reproduces.

These MUST match the engine the adapter wraps (agent_adapter.constants has
the same values). SPEED / JUMP_FORCE / GRAVITY feed the jump-reach
prefilter + action enumeration.
"""

TILE = 20
SPEED = 240
JUMP_FORCE = 560
GRAVITY = 1600
