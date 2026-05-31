# agent-adapter (Python)

A **Python physics adapter** for the 2D level-designer's planning agent
— a faithful, standalone port of the JS engine (`src/play/*`) exposed
through the same contract the JS agent consumes:
`{ TILE, make_scene, make_scripted_input }` (the mirror of
`src/agent-adapter.js`'s `jsAdapter`).

This is the first step of the v29 design's deferred "Python adapter"
item. **Standalone** — there is no runtime coupling to the JS code. A
future Python port of the agent would depend on *only* this object,
exactly as the JS agent depends only on `jsAdapter`.

## Why a port, not a bridge

The JS agent runs **millions** of per-frame simulation steps per plan
(`expandNode` simulates ~46 actions per A* node, over up to 100k nodes).
A live Node↔Python bridge at that granularity would be unusably slow.
So the Python side reimplements the physics natively; correctness is
guaranteed not by sharing code but by **golden-vector parity** against
the real JS engine.

## What's ported

Line-for-line from the vendored engine:

| Python | JS source |
|--------|-----------|
| `constants.py` | `src/play/constants.js` (+ `DEFAULT_LEGEND` roles from `src/level.js`) |
| `aabb.py` | `src/play/core/aabb.js` (`rects_overlap`, `resolve_axis`) |
| `scripted_input.py` | `src/play/scriptedInput.js` |
| `entities.py` | `src/play/entities/*` + `toWorld` (`src/play/adapter.js`) |
| `scene.py` | `src/play/playtestScene.js` (restart, spawn-fall settle, update, set_player_state) |
| `play_settings.py` | `meetsPickupRequirement` (`src/playSettings.js`) |
| `adapter.py` | `src/agent-adapter.js` (`jsAdapter` → `py_adapter`) |

The `Player.update` integration is the crux: gravity → x-move + resolve
→ **swept-Y** crossing test (speed-independent landing/head-bump),
identical to the JS axis-resolved model.

## Usage

```python
from agent_adapter import py_adapter, DEFAULT_LEGEND

level = {
    "grid": ["########", "#P....E#", "########"],
    "meta": {"width": 8, "height": 3, "pickupRequired": 0},
}
inp = py_adapter.make_scripted_input([{"frame": 0, "key": "right", "down": True}])
scene = py_adapter.make_scene(level, DEFAULT_LEGEND)
scene.game.input = inp

for f in range(240):
    inp.advance(f)
    scene.update(1 / 60)
    if scene.phase != "play":
        break
# scene.phase == "won"
```

Run the standalone smoke:

```
python3 packages/agent-py/examples/simulate.py
```

## Parity tests

The golden vectors in `tests/golden/vectors.json` are produced by
driving the **real JS engine** over a set of cases — six hand-authored
primitives (walk, jump arc, head-bump, pit death, spike death, coin
pickup) plus three cases driven by the **JS agent's own `plan()`
recordings** on real levels (`tutorial`, `simple`, `above_ground`). The
pytest suite replays each case through the Python adapter and asserts
every per-frame `(x, y, vx, vy, onGround, phase, score)` matches within
1e-9 (IEEE-754 doubles + identical op order → effectively exact).

```
# regenerate vectors from the JS engine (run from the repo root):
node packages/agent-py/tools/gen_golden.mjs

# run the Python parity + contract tests:
cd packages/agent-py && python3 -m pytest
```

If a parity test fails after an engine change, regenerate the vectors
and review the diff — a real physics change in `src/play/*` must be
mirrored here (and the agent's `TILE` contract still applies).

## Status / next

This package is the **physics adapter** only. A Python port of the
planner itself (so a level solves end-to-end in pure Python) is the
natural follow-up — it would import `py_adapter` and nothing else from
here.
