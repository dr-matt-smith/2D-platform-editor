"""Adapter-contract + basic-physics unit tests (no golden vectors)."""

from agent_adapter import DEFAULT_LEGEND, py_adapter


def _flat_level():
    # P at (1,1), exit at (1,3), solid floor below.
    return {"grid": ["#####", "#P.E#", "#####"], "meta": {"width": 5, "height": 3}}


def test_adapter_shape():
    assert py_adapter.TILE == 20
    assert callable(py_adapter.make_scene)
    assert callable(py_adapter.make_scripted_input)


def test_make_scene_is_entered_and_settled():
    scene = py_adapter.make_scene(_flat_level(), DEFAULT_LEGEND)
    assert scene.phase == "play"
    assert scene.player is not None
    # Spawn-fall settle leaves the player grounded on the floor.
    assert scene.player.on_ground is True
    assert scene.player.x == 20  # cell (1,1) -> x = 1 * TILE
    assert scene.player.y == 20


def test_scripted_input_shape():
    inp = py_adapter.make_scripted_input(
        [{"frame": 1, "key": "right", "down": True}]
    )
    assert inp.is_down("right") is False  # not advanced yet
    inp.advance(1)
    assert inp.is_down("right") is True
    assert inp.was_pressed("right") is True
    inp.advance(2)  # new frame clears one-shot pressed
    assert inp.was_pressed("right") is False
    assert inp.is_down("right") is True


def test_set_player_state():
    scene = py_adapter.make_scene(_flat_level(), DEFAULT_LEGEND)
    scene.set_player_state(40, 60, vx=5, vy=-3, on_ground=False)
    assert (scene.player.x, scene.player.y) == (40, 60)
    assert (scene.player.vx, scene.player.vy) == (5, -3)
    assert scene.player.on_ground is False


def test_walk_right_reaches_exit():
    scene = py_adapter.make_scene(_flat_level(), DEFAULT_LEGEND)
    inp = py_adapter.make_scripted_input(
        [{"frame": 0, "key": "right", "down": True}]
    )
    scene.game.input = inp
    for f in range(120):
        inp.advance(f)
        scene.update(1 / 60)
        if scene.phase != "play":
            break
    assert scene.phase == "won"
