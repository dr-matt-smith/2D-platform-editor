# agent-py (Python)

Two standalone Python packages that together let a level solve
end-to-end in pure Python:

| Package | Mirrors | Role |
|---------|---------|------|
| `agent_adapter` | `src/play/*` + `src/agent-adapter.js` | **physics adapter** — a faithful port of the JS engine, exposed through `{ TILE, make_scene, make_scripted_input }` |
| `agent_planner` | `packages/agent/src/*` | **planning agent** — A* search that emits a solving input recording |

`agent_planner` depends on **only** the adapter object (passed via
`adapter=`), exactly as the JS agent depends only on `jsAdapter`. There
is no runtime coupling to the JS code in either package — correctness is
guaranteed by golden-vector + recording parity against the real JS code.

---

## agent_adapter — the physics adapter

A faithful, standalone port of the JS engine (`src/play/*`) exposed
through the same contract the JS agent consumes:
`{ TILE, make_scene, make_scripted_input }` (the mirror of
`src/agent-adapter.js`'s `jsAdapter`).

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

---

## agent_planner — the planning agent

A faithful port of the JS agent (`packages/agent/src/*`). Given a parsed
level, it searches for an input recording that solves it (collect
required pickups, reach the exit) and returns up to five distinct
solutions, each with an explainable trace. The default backend is the
v28 **per-frame trajectory planner**: A* nodes carry the full
continuous-physics state and edges are produced on the fly by simulating
actions, so the recording it emits replays byte-identically on the live
engine.

```python
from agent_adapter import py_adapter, DEFAULT_LEGEND
from agent_planner import test_level, plan, simulate

parsed = {
    "grid": ["#####", "#P.E#", "#####"],
    "meta": {"width": 5, "height": 3, "pickupRequired": 0},
}
result = test_level(parsed, DEFAULT_LEGEND, adapter=py_adapter)
# result["ok"] is True
# result["solution"]["recording"] — the winning ScriptedInput events
# result["solutions"] — up to 5 distinct solutions, shortest first
```

`plan(parsed, legend, adapter=py_adapter)` is the lower-level entry (one
plan, no replan loop); `simulate(py_adapter, parsed, legend,
recording=...)` runs a recording headlessly. Every entry that simulates
physics takes the adapter via the `adapter` keyword — the agent's only
engine dependency. `assert_adapter()` throws at the public boundary if
`adapter.TILE` doesn't match the agent's `TILE` (a misconfigured adapter
would silently emit edges the live engine never reproduces).

The recording/state convention is Python-native dicts: actions are
`{"kind", "params"}`, recording events are `{"frame", "key", "down"}`,
and physics states are `{"x", "y", "vx", "vy", "on_ground"}` (the exact
kwargs of `set_player_state`).

Run the standalone solve:

```
python3 packages/agent-py/examples/solve.py
```

### Planner parity

The golden vectors include the **JS agent's own `plan()` recordings** on
three real levels (`tutorial`, `simple`, `above_ground`), generated by
driving the real JS planner (`tools/gen_golden.mjs`). The pytest suite
runs the Python planner over the same parsed levels and asserts the
emitted recording is **identical event-for-event**. Because the
recording matches and the adapter is frame-parity-exact, the Python
agent solves these levels exactly as the JS agent does.

A subtle parity detail: A*'s equivalence-class `cluster_key` rounds with
JS `Math.round` semantics (round half toward +∞), not Python's
banker's rounding — `_js_round` enforces this so cluster boundaries fall
identically.

---

## Status / next

Both the **physics adapter** and the **planner** are ported and
parity-tested against the JS code. A natural follow-up is an
MCP-callable wrapper so other agents can submit a level and get back a
solving recording (the v29 "open to other agents" item).
