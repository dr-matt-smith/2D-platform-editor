"""Engine-physics constants — a faithful copy of src/play/constants.js.

These MUST match the JS engine the agent was built against; the golden
parity tests assert the Python adapter reproduces the JS engine
frame-for-frame, which only holds if these are identical.
"""

TILE = 20
SPEED = 240
JUMP_FORCE = 560
GRAVITY = 1600

# Char -> v11 role, mirroring src/level.js DEFAULT_LEGEND. Only the
# `role` matters to the physics adapter (toWorld maps role -> entity).
DEFAULT_LEGEND = {
    ".": "background",
    "#": "terrain",
    "P": "player",
    "^": "hazard",
    "o": "pickup",
    "E": "exit",
}


def role_of(legend, char):
    """Char -> role, or None for chars not in the legend (mirrors roleOf)."""
    if not legend:
        return None
    entry = legend.get(char)
    if entry is None:
        return None
    # Accept either a bare role string (our compact legend) or a dict
    # with a 'role' key (the JS legend shape), so callers can pass either.
    if isinstance(entry, str):
        return entry
    return entry.get("role")
