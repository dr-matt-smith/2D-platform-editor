# @2d-platform/agent

The 2D level-designer's planning agent. Carved out of the editor in
v29 so alternate implementations (a Python solver, an MCP-callable
service) can drive it through a thin **physics-adapter** API instead of
importing the editor's vendored engine directly.

In-repo only — `private: true`, not published to npm (a v30+ candidate).

## What it does

Given a parsed level, the agent searches for an input recording that
solves it (collect required pickups, reach the exit) and returns up to
five distinct solutions, each with an explainable trace. The default
backend is the v28 **per-frame trajectory planner**: A* nodes carry the
full continuous-physics state and edges are produced on the fly by
simulating actions, so the recording it emits replays byte-identically
on the live engine.

## Usage

```js
import { testLevel } from '@2d-platform/agent';
import { jsAdapter } from '../../src/agent-adapter.js'; // the editor's JS adapter
import { parse, DEFAULT_LEGEND } from '../../src/level.js';

const parsed = parse('#####\n#P.E#\n#####');
const result = await testLevel(parsed, DEFAULT_LEGEND, null, {
  adapter: jsAdapter,   // REQUIRED (v29)
  maxRuntimeMs: 5000,
});
// result.ok === true
// result.solution.recording — the winning ScriptedInput events
// result.solutions — up to 5 distinct solutions, shortest first
```

`plan(parsed, legend, { adapter })` is the lower-level entry (one plan,
no replan loop); `simulate({ adapter, parsed, legend, recording })`
runs a recording headlessly.

## Physics-adapter contract

The agent's ONLY engine dependency is the adapter object passed via
`opts.adapter` (or the leading argument to `buildNavGraph`). It must
expose:

```js
const adapter = {
  // Engine tile size in px. Verified against the agent's own TILE at
  // plan()/testLevel() entry — a mismatch throws immediately.
  TILE: 20,

  // Build a fresh, already-entered scene from a parsed level. Returns a
  // handle the agent reads/steps:
  //   .game       mutable { input, assets } — the agent swaps game.input
  //   .player     AABB pose + velocity + onGround
  //   .coins      pickup entities (collected flag)
  //   .phase      'play' | 'won' | 'dead'
  //   .score, .simFrame, .simTime
  //   .enter()             builds entities, phase='play'
  //   .update(dt)          steps physics one tick
  //   .setPlayerState({ x, y, vx, vy, onGround })  forces the player pose
  makeScene(parsed, legend, tileset) { /* ... */ },

  // Build a scripted input source from a recording. Returns a handle
  // with .advance(frame), .isDown(key), .wasPressed(key), .endFrame().
  makeScriptedInput(recording) { /* ... */ },
};
```

`src/agent-adapter.js` in the editor is the reference JS adapter — it
wraps the vendored `PlaytestScene` + `ScriptedInput`. A Python adapter
would expose the same shape over a Node↔Python bridge.

### Why the TILE check

The agent discretises levels into a cell grid at `TILE` px. If an
adapter wraps an engine with a different tile size (e.g. a Python
adapter that accidentally shipped the editor's display TILE=24 instead
of the engine's physics TILE=20), every edge the agent simulates would
land on the wrong cell and the plan would silently fail to reproduce on
the live engine. `assertAdapter()` throws at the public boundary so the
misconfiguration is loud and immediate.

## Standalone smoke

```
node packages/agent/examples/headless.js
```

Constructs a minimal **stub adapter** (no real physics — a toy walk
model) and runs `plan()` on a trivial level, demonstrating that the
agent's only engine coupling is the adapter object.
