# Version 29 Build Transcript

Status: **Delivered (2026-05-30)** — _the planning agent is carved into
the `@2d-platform/agent` workspace package; its only engine dependency
is an injected physics adapter._
Design: [../1_design/version29_design.md](../1_design/version29_design.md)
· Plan: [../2_implementation/version29_implementation.md](../2_implementation/version29_implementation.md)

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `d595eec` | physics-adapter scaffolding (`src/agent-adapter.js` → `jsAdapter`) |
| 2 | `6ceb9af` | `simAction.js` + `sim.js` mint scene/input through the adapter |
| 3 | `c9ff625` | thread adapter through grid + planner + perframe + runner; `assertAdapter` contract; `main.js` wires `jsAdapter` |
| 4 | `5fecd4e` | agent-local `constants.js`; `packages/*` workspace scaffolding |
| 5 | `ad1af49` | `git mv src/agent → packages/agent/src`; public API + README + headless smoke |
| 6 | _this commit_ | transcript + Delivered |

Tests at delivery: **297 unit / 140 Playwright** (139 active + 1
carry-over skip; +3 v29-adapter, +3 v29-workspace, +2 v29-package-smoke,
+2 node contract tests over the v28 baseline of 295/132). v9 §7
invariant preserved — the vendored `src/play/core/*` + `entities/*`
are byte-untouched, and after M4 the agent imports **nothing** from
`src/play/*`.

## The shape of the refactor

v29 is a single-thread, control-inversion refactor with one rule that
made it safe: **the file move lands LAST**. v22→v28 hardened the agent
into a reliable solver bound to the editor's file layout — it imported
`PlaytestScene`, `ScriptedInput`, and the engine constants straight
from `src/play/*`. The temptation was to `git mv` first and fix the
fallout. Instead M1–M4 made the agent engine-agnostic **in place**, so
M5's move was mechanical: by the time the files moved, not one of them
imported anything outside the agent directory.

The dependency was inverted in four steps, each a green-tests gate:

1. **M1 — set the table.** `src/agent-adapter.js` exports
   `jsAdapter = { TILE, makeScene, makeScriptedInput }` wrapping the
   vendored engine. Nothing consumed it yet; it just gave M2 a target.
2. **M2 — leaves first.** `simAction.js` + `sim.js` (the only modules
   that ever wrote `new PlaytestScene` / `new ScriptedInput`) now mint
   both through the injected adapter. Their callers kept their old
   signatures via a **temporary `_adapter` glue import** so the rest of
   the agent — and every test — stayed green at the gate.
3. **M3 — thread to the boundary.** The adapter argument reached the
   public entries. `buildNavGraph` gained a leading `adapter`;
   `plan` / `testLevel` require `opts.adapter`; `expandNode` /
   `aStarPerFrame` / `planPerFrame` thread it through `getContext`. The
   M2 glue was deleted. `main.js` wires `jsAdapter` once.
4. **M4 — sever the last thread.** The agent's `TILE` (and `SPEED` /
   `JUMP_FORCE` / `GRAVITY`) moved to a local `constants.js`. With that,
   `grep "play/" src/agent/*.js` came back empty.

## The audit pass (M1)

`grep -rn "PlaytestScene\|ScriptedInput\|TILE" src/agent/` surfaced a
small surface, exactly as the design predicted:

- `simAction.js` + `sim.js`: the only `new PlaytestScene` /
  `new ScriptedInput` sites; both also read `TILE`.
- `grid.js`, `planner.js`, `perframe.js`, `actions.js`: physics
  constants only (`TILE`, and `grid`/`actions` also `SPEED` /
  `JUMP_FORCE` / `GRAVITY` for the jump-reach prefilter + action
  enumeration).
- `overlay.js`, `runner.js`, `index.js`: nothing engine-related.

So the adapter surface the agent actually uses is narrow: construct a
scene, force a player state, step it, read `player` / `coins` / `phase`
/ `simFrame` / `simTime`, and mint a scripted input. The adapter ended
up with exactly two factory methods — `makeScene` returns an
**already-entered** scene (so callers never call `enter()` twice) whose
`game` is a mutable `{ input, assets }` the agent swaps per action;
`makeScriptedInput` wraps a recording.

## Where the threading bit (M2→M3)

The one non-mechanical decision was **how `expandNode` receives the
adapter**. Threading it as a positional argument would have broken
`v28-expand.spec.js`'s four call sites and the public signature. It
goes through `opts.adapter` instead — `expandNode(cache, parsed,
legend, tileset, state, opts)` keeps its shape, reads `opts.adapter`,
and forwards it to `getContext(cache, adapter, …)`. `planPerFrame` and
`aStarPerFrame` were already opts-threaded, so the adapter rode along.

The signature change that reached the most call sites was
`simulate({ adapter, … })` and `makeSimContext(adapter, …)`: between
node tests and Playwright specs, **14 spec files** gained an
`adapter: jsAdapter` (the browser specs import it from
`/src/agent-adapter.js`; node tests from `../agent-adapter.js`, later
`../../../src/agent-adapter.js` after the move). All mechanical; the
suite gate caught the two single-line opts calls the bulk `perl` pass
missed.

## The TILE-mismatch contract

`assertAdapter(adapter, where)` runs at the top of `plan()` and
`testLevel()`. It throws if the adapter is missing, and — the part that
earns its keep — if `adapter.TILE !== TILE` (the agent's compiled-in
value). The failure mode it guards against: a future Python adapter
that ships the editor's **display** `TILE = 24` instead of the engine's
**physics** `TILE = 20`. Without the check, every edge the agent
simulates would discretise onto the wrong cell grid and the plan would
silently fail to reproduce on the live engine — a maddening "the agent
says it solves but the player walks into a wall" bug. With it, the
misconfiguration throws at the boundary: _"adapter.TILE (24) does not
match the agent's TILE (20)."_ Two node tests lock both throws.

## The move (M5)

`git mv` relocated **16 files** (`src/agent/*` → `packages/agent/src/`).
Because M2–M4 had already cut every cross-directory import from the
agent's _source_, the only fixups were in the moved _test_ files: they
still reach back to the editor for `jsAdapter` and the `parse` helper,
so `../level.js` became `../../../src/level.js` and likewise for
`../agent-adapter.js` and `../play/scriptedInput.js`. In-repo coupling
of tests to the editor is fine — the package is `private`, not
published.

`main.js` now imports the bare specifier `@2d-platform/agent`. npm
workspaces symlink it into `node_modules`, but resolution is pinned
deterministically by a new `vite.config.js` `resolve.alias` →
`packages/agent/src/index.js`, so `npm run build` + `build:pages` +
the Playwright dev server all resolve it without depending on install
state. The Playwright specs themselves import the served path
`/packages/agent/src/…` directly (a browser runtime `import()` can't
resolve a bare specifier).

`packages/agent/examples/headless.js` is the proof of decoupling: it
builds a **stub adapter** — a toy flat-world walk model with zero
`src/play/*` dependency — hand-builds a parsed level, and runs `plan()`.
`node packages/agent/examples/headless.js` prints a non-empty trace.
The agent planned with no editor engine in sight.

## Stats

- **Files moved:** 16 (`git mv`, history preserved).
- **Editor `src/` after the move:** ~7.8k lines of JS, of which the
  agent's ~2.5k now live in `packages/agent/src/`. The editor's only
  remaining `src/play/*` consumer outside `main.js` / `renderer.js` is
  the 80-line `src/agent-adapter.js`.
- **Bundle:** ~85 kB (gzip ~29.5 kB) — unchanged in principle (same
  code, relocated; the index re-export list added a handful of symbols,
  no measurable delta).

## Follow-ups (design §9 → v30+)

- **Publish `@2d-platform/agent` to npm** with semver + release notes.
- **Carve out `@2d-platform/play`** — the vendored engine + scene +
  entities — so both editor and agent depend on it; today the editor's
  `agent-adapter.js` still reaches into `src/play/*` directly.
- **A real Python adapter** over a Node↔Python bridge, validated
  against the same contract `jsAdapter` satisfies (the TILE check is
  waiting for it).
- **MCP server** exposing the agent as callable tools.
- **Re-enable the v21 searching-state spec** (the 1 carry-over skip),
  gated on the minimum-render-duration hook in `agentDialog`.
