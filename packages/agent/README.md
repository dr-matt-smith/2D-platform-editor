# @2d-platform/agent

The level editor's planning agent: it finds a key recording that solves a
level, by A* over simulated physics. It never imports a game engine — it
drives one through the `PhysicsAdapter` interface it defines, so the same
planner runs on the JS engine (`jsAdapter` from `@2d-platform/engine`), on
the Python port, or on a test stub.

In-repo only — not published.

Class-by-class documentation, with a class diagram and a walk-through of
how planning works: [docs/agent](../../docs/agent/README.md).

## What it does

Given a parsed level, the agent searches for an input recording that
solves it (collect the required pickups, reach the exit) and returns up to
five distinct solutions, each with an explained trace. The default strategy
is the **per-frame planner**: A* nodes carry the full continuous-physics
state and edges are produced on the fly by simulating actions, so the
recording it emits replays exactly on the live engine.

## Usage

```ts
import { LevelTester, PlannerFactory, Simulator } from '@2d-platform/agent';
import { jsAdapter } from '@2d-platform/engine';
import { Legend, Level } from '@2d-platform/level-format';

const level = Level.parse('#####\n#P.E#\n#####');
const legend = Legend.DEFAULT.toRecord(); // the agent takes a plain record

// Plan, check by replaying, and collect alternative routes.
const result = await LevelTester.create(jsAdapter).test(level, legend, null, {
  maxRuntimeMs: 5000,
});
// result.ok === true
// result.solution.recording — the winning key events
// result.solutions — up to 5 distinct solutions, fewest frames first

// Lower level: one plan, no replay.
const plan = PlannerFactory.create(jsAdapter).plan(level, legend);
// Replay any recording headless.
const sim = new Simulator(jsAdapter).run(level, legend, plan.recording);
```

`PlannerFactory.create(adapter, PlannerKind.Bucket)` selects the older
bucket-graph planner, kept for diagnostics.

## The physics-adapter contract

The agent's only engine dependency is the adapter it is given:

```ts
interface PhysicsAdapter {
  // Engine tile size in px; must equal the agent's TILE (20).
  readonly TILE: number;
  // A fresh, already-entered scene of the level.
  makeScene(parsed: ParsedLevel, legend: LegendRecord | null, tileset: unknown): SceneHandle;
  // A scripted input source that replays a recording.
  makeScriptedInput(recording: Recording): ScriptedInputHandle;
}
```

A `SceneHandle` exposes what the agent reads and writes: `game.input` (the
agent swaps it per simulation), `player` (position, velocity, size,
`onGround`), `coins`, `phase` (`'play' | 'won' | 'dead'`), `score`, the
`simFrame` / `simTime` clocks, `update(dt)` and `setPlayerState(state)`.
The engine's `JsPhysicsAdapter` (`packages/engine/src/JsPhysicsAdapter.ts`)
is the reference implementation; the Python port in `packages/agent-py`
has its own.

### Why the TILE check

The agent cuts levels into cells at `TILE` px. If an adapter wraps an
engine with a different tile size (say a port that shipped a display tile
size of 24 instead of the physics tile size of 20), every simulated edge
lands on the wrong cell and plans silently fail on the live engine.
`AdapterGuard` checks the adapter when a planner or tester is created, so
the misconfiguration is loud and immediate.

## Standalone smoke

```
deno run -A packages/agent/examples/headless.ts
```

Implements `PhysicsAdapter` with a minimal **stub** (no real physics — a
toy walk model) and asks a planner to plan a trivial level, showing that
the adapter is the agent's only engine coupling.
