"""AABB helpers — a faithful port of src/play/core/aabb.js."""


def rects_overlap(a, b):
    return (
        a.x < b.x + b.w
        and a.x + a.w > b.x
        and a.y < b.y + b.h
        and a.y + a.h > b.y
    )


def resolve_axis(player, solid, axis):
    """Resolve overlap on one axis after moving on it.

    Returns the corrected coordinate on `axis` (caller assigns it back),
    or None when the rects don't overlap.
    """
    if not rects_overlap(player, solid):
        return None
    if axis == "x":
        if player.x + player.w / 2 < solid.x + solid.w / 2:
            return solid.x - player.w
        return solid.x + solid.w
    if player.y + player.h / 2 < solid.y + solid.h / 2:
        return solid.y - player.h
    return solid.y + solid.h
