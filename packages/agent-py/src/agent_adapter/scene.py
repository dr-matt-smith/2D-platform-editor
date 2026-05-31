"""PlaytestScene — a faithful headless port of src/play/playtestScene.js.

Only the simulation-relevant surface is ported (no canvas, no camera
draw): restart() with spawn-fall settle, the ScriptedInput tick, the
per-frame update (player physics + coin pickup + spike/pit death + win),
and setPlayerState. The agent reads .player / .coins / .phase / .score
/ .sim_frame / .sim_time and steps .update(dt).
"""

import math

from .aabb import rects_overlap
from .entities import to_world
from .play_settings import meets_pickup_requirement


class _NoInput:
    """No-key stub used during spawn-fall settle (no .advance, so the
    scripted-input tick skips it)."""

    def is_down(self, key):
        return False

    def was_pressed(self, key):
        return False

    def end_frame(self):
        pass


class PlaytestScene:
    def __init__(self, game, parsed, legend, tileset=None):
        self.game = game
        self.parsed = parsed
        self.legend = legend
        self.tileset = tileset
        self.player = None
        self.platforms = []
        self.coins = []
        self.spikes = []
        self.goals = []
        self.world_w = 0
        self.world_h = 0
        self.score = 0
        self.total = 0
        self.required_pickups = "all"
        self.phase = "play"
        self.sim_frame = 0
        self.sim_time = 0.0

    def enter(self):
        self.restart()

    def restart(self):
        w = to_world(self.parsed, self.legend)
        self.player = w["player"]
        self.platforms = w["platforms"]
        self.coins = w["coins"]
        self.spikes = w["spikes"]
        self.goals = w["goals"]
        self.world_w = w["world_w"]
        self.world_h = w["world_h"]
        self.score = 0
        self.total = len(self.coins)
        meta = self.parsed.get("meta", {})
        self.required_pickups = meta.get("pickupRequired", "all")
        self.phase = "play"

        # v22 spawn-fall settle: drop the player by gravity-only physics
        # (no input) until they land or the 30-frame budget is spent, so
        # the input timeline starts at the moment the player is grounded.
        self._spawn_fall_settle()

        self.sim_frame = 0
        self.sim_time = 0.0

    def _spawn_fall_settle(self):
        if self.player is None or self.player.on_ground:
            return
        original = self.game.input
        self.game.input = _NoInput()
        try:
            for _ in range(30):
                self.player.update(1 / 60, self)
                if self.player.on_ground:
                    break
        finally:
            self.game.input = original

    def _tick_scripted_input(self, dt):
        inp = self.game.input
        if not hasattr(inp, "advance"):
            return
        self.sim_time += dt
        target = math.floor(self.sim_time * 60)
        while self.sim_frame < target:
            inp.advance(self.sim_frame)
            self.sim_frame += 1

    def set_player_state(self, x, y, vx=0, vy=0, on_ground=False):
        if self.player is None:
            return
        self.player.x = x
        self.player.y = y
        self.player.vx = vx
        self.player.vy = vy
        self.player.on_ground = on_ground

    def update(self, dt):
        # Advance the ScriptedInput timeline BEFORE reading input state.
        self._tick_scripted_input(dt)

        inp = self.game.input

        if self.phase != "play":
            if inp.was_pressed("r"):
                self.restart()
            return

        self.player.update(dt, self)

        for c in self.coins:
            if not c.collected and rects_overlap(self.player, c):
                c.collected = True
                self.score += 1
                self.game.assets.play("coin", {"volume": 0.4})

        for s in self.spikes:
            if rects_overlap(self.player, s):
                self.phase = "dead"
                return

        if self.player.y > self.world_h + 50:
            self.phase = "dead"
            return

        if meets_pickup_requirement(self.score, self.total, self.required_pickups):
            for g in self.goals:
                if rects_overlap(self.player, g):
                    self.phase = "won"
                    return

        if inp.was_pressed("r"):
            self.restart()
