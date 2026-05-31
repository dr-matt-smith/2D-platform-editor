"""Entities + toWorld — a faithful port of src/play/entities/* and
src/play/adapter.js (toWorld).

Every entity is a TILE x TILE AABB. Only the Player carries physics;
the rest are static colliders / triggers. Collision + integration in
Player.update mirror the vendored engine axis-for-axis.
"""

from .constants import GRAVITY, JUMP_FORCE, SPEED, TILE, role_of
from .aabb import resolve_axis


class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.w = TILE
        self.h = TILE
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False

    def update(self, dt, scene):
        """Axis-resolved integration with swept-Y collision — a
        line-for-line port of Player.update (src/play/entities/player.js).
        """
        inp = scene.game.input

        self.vx = 0
        if inp.is_down("left"):
            self.vx = -SPEED
        if inp.is_down("right"):
            self.vx = SPEED

        wants_jump = inp.was_pressed("space") or inp.was_pressed("up")
        if wants_jump and self.on_ground:
            self.vy = -JUMP_FORCE
            self.on_ground = False

        self.vy += GRAVITY * dt

        # --- x axis: move then resolve overlaps -----------------------
        self.x += self.vx * dt
        for p in scene.platforms:
            corrected = resolve_axis(self, p, "x")
            if corrected is not None:
                self.x = corrected

        # --- y axis: swept crossing test (speed-independent) ----------
        prev_y = self.y
        moved_y = prev_y + self.vy * dt

        resolved_y = moved_y
        landed = False
        bumped = False
        self.on_ground = False

        for p in scene.platforms:
            # Only collide vertically when horizontally over/under the tile.
            if self.x >= p.x + p.w or self.x + self.w <= p.x:
                continue
            if self.vy >= 0:
                prev_bottom = prev_y + self.h
                moved_bottom = moved_y + self.h
                if prev_bottom <= p.y and moved_bottom >= p.y:
                    top = p.y - self.h
                    if not landed or top < resolved_y:
                        resolved_y = top
                    landed = True
            else:
                ceiling = p.y + p.h
                if prev_y >= ceiling and moved_y <= ceiling:
                    if not bumped or ceiling > resolved_y:
                        resolved_y = ceiling
                    bumped = True

        self.y = resolved_y
        if landed:
            self.vy = 0
            self.on_ground = True
        elif bumped:
            self.vy = 0


class _Box:
    """A plain TILE x TILE AABB used by Platform / Coin / Spike / Goal."""

    __slots__ = ("x", "y", "w", "h")

    def __init__(self, x, y, w=TILE, h=TILE):
        self.x = x
        self.y = y
        self.w = w
        self.h = h


class Platform(_Box):
    def __init__(self, x, y, w=TILE, h=TILE, kind="platform"):
        super().__init__(x, y, w, h)
        self.kind = kind


class Coin(_Box):
    def __init__(self, x, y):
        super().__init__(x, y)
        self.collected = False


class Spike(_Box):
    pass


class Goal(_Box):
    pass


def to_world(parsed, legend, tile=TILE):
    """parsed level -> entity world, mapping glyphs to entities BY ROLE
    (mirrors src/play/adapter.js toWorld).

    `parsed` is a dict with `grid` (list of row strings) and `meta`
    (with `width` + `height`).
    """
    grid = parsed["grid"]
    meta = parsed["meta"]
    platforms = []
    coins = []
    spikes = []
    goals = []
    player = None

    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            x = c * tile
            y = r * tile
            role = role_of(legend, ch)
            if role == "terrain":
                platforms.append(Platform(x, y, tile, tile, "ground"))
            elif role == "player":
                player = Player(x, y)  # last wins (deterministic)
            elif role == "hazard":
                spikes.append(Spike(x, y))
            elif role == "pickup":
                coins.append(Coin(x, y))
            elif role == "exit":
                goals.append(Goal(x, y))
            # decoration / background / unknown / None -> ignored

    return {
        "player": player,
        "platforms": platforms,
        "coins": coins,
        "spikes": spikes,
        "goals": goals,
        "world_w": meta["width"] * tile,
        "world_h": meta["height"] * tile,
    }
