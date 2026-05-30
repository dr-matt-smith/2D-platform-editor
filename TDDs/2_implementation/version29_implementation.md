# Version 29 — Implementation Plan

Status: **Delivered (2026-05-30)** · Design:
[../1_design/version29_design.md](../1_design/version29_design.md)
· Transcript:
[../3_transcripts/version29_build.md](../3_transcripts/version29_build.md)

Shipped commits: M1 `d595eec` · M2 `6ceb9af` · M3 `c9ff625` ·
M4 `5fecd4e` · M5 `ad1af49` · M6 _this commit_.

Six path-scoped commits. The refactor inverts control: the agent
stops importing from `src/play/*` directly and instead receives a
physics-adapter object. The file move to `packages/agent/` lands
LAST (M5) — earlier milestones make the agent engine-agnostic
in-place so the move is mechanical.

| M | Deliverable |
|---|-------------|
| 1 | Adapter interface + `jsAdapter` (no agent code touches the engine yet) |
| 2 | `simAction.js` + `sim.js` consume the injected adapter |
| 3 | `grid.js` + `planner.js` + `perframe.js` + `runner.js` thread adapter through |
| 4 | Agent owns its own `TILE` constant; workspace scaffolding |
| 5 | Move `src/agent/*` → `packages/agent/src/*` + public API + README + smoke |
| 6 | Acceptance + transcript + Delivered |

Tests at delivery target: **295 unit / 132+ Playwright** (+1 new
smoke spec, +1 skipped carry-over). v9 §7 invariant preserved
(vendored `src/play/core/*` + `src/play/entities/*` byte-identical;
the agent NEVER imports them after M3).

## Process (same discipline as v8–v28)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  Never-stage: `__temp/wish_list.md`, `__temp/next_version.md`,
  `__temp/test_levels/`, `__temp/screenshots/`,
  `__temp/open_to_other_agents.md`,
  `public/data/levels/manifest.json` (modifications),
  `public/data/levels/above_ground2.txt`, `fred.txt`, tileset
  `src.txt` / `sources.txt` modifications, kenney
  `flag_green.png`.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v29 only modifies
  `src/agent/*` and `src/main.js` (+ new `src/agent-adapter.js`)
  through M4; M5 moves the agent files but doesn't touch the
  vendored play engine.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - M1 (adapter scaffolding) is additive — `src/agent-adapter.js`
    exists but no agent code calls it; `main.js`'s testLevel
    invocation is unchanged.
  - M2 (simAction + sim adapter) — internal refactor of the
    leaf-level simulator modules. Their callers (grid, planner,
    perframe, runner) thread an adapter argument through.
  - M3 (planners adapter) — the threading reaches the public
    `plan()` and `testLevel()` entries. `main.js` passes
    `jsAdapter`. Behavior byte-identical because `jsAdapter`
    constructs the same PlaytestScene + ScriptedInput the leaf
    used to construct itself.
  - M4 (TILE local) — agent's `import { TILE } from
    '../play/constants.js'` becomes `import { TILE } from
    './constants.js'`. The agent's `constants.js` re-exports
    `TILE = 20` (same value); a runtime assertion in the adapter
    contract verifies the adapter's TILE matches.
  - M5 (file move) is mechanical — git mv + sed-update imports +
    `vite.config.js` alias.
- **Adapter contract verification**: at the public-entry boundary
  (`testLevel`, `plan`), throw if `opts.adapter.TILE` doesn't
  match the agent's expected `TILE`. Catches a misconfigured
  adapter early.
- **Feature flags carry through**: M3 keeps `opts.planner ∈
  {'bucket', 'perframe'}` unchanged; the per-frame planner stays
  the default.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/agent-adapter.js` (new) | Exports `jsAdapter = { TILE, makeScene, makeScriptedInput }` wrapping `PlaytestScene` + `ScriptedInput` + `TILE` from `src/play/*` | M1 |
| `tests/v29-adapter.spec.js` (new) | Asserts `jsAdapter` exposes the expected shape; `makeScene` returns a `PlaytestScene`-shaped handle | M1 |
| `src/agent/simAction.js` | `makeSimContext(adapter, parsed, legend, tileset)` — call `adapter.makeScene` + `adapter.makeScriptedInput`. Public sig changes: callers gain `adapter` arg | M2 |
| `src/agent/sim.js` | `simulate({ adapter, parsed, legend, tileset?, recording, ... })` — same threading pattern. The internal `new PlaytestScene` + `new ScriptedInput` calls go through adapter | M2 |
| `src/agent/sim.test.js` (if exists) / Playwright specs that call `simulate` | Pass `adapter: jsAdapter` (or `stubAdapter` for Node tests) | M2 |
| `src/agent/grid.js` | `buildNavGraph(adapter, parsed, legend, tileset)`. `addActionEdges` threads the adapter via `ctx`. `makeSimContext` calls update | M3 |
| `src/agent/planner.js` | `plan(parsed, legend, opts)` — `opts.adapter` is required. `aStar`, `resolveGoals`, `emitLegInputs` unchanged (don't touch engine) | M3 |
| `src/agent/perframe.js` | `planPerFrame(parsed, legend, tileset, opts)` — `opts.adapter` threaded into `expandNode` + `aStarPerFrame`. `makeContextCache` unchanged (Map keyed by parsed) | M3 |
| `src/agent/runner.js` | `testLevel(parsed, legend, tileset, opts)` — `opts.adapter` required. Pass through to `plan` + `simulate` | M3 |
| `src/main.js` | All `testLevel(...)` + `plan(...)` calls pass `adapter: jsAdapter` | M3 |
| `src/agent/constants.js` (new) | `export const TILE = 20;` — local constant for agent | M4 |
| Every agent file currently doing `import { TILE } from '../play/constants.js'` | Replace with `import { TILE } from './constants.js'` | M4 |
| `package.json` (root) | Add `"workspaces": ["packages/*"]`. Add devDependency `"@2d-platform/agent": "workspace:*"` | M4 |
| `packages/agent/package.json` (new) | `{ "name": "@2d-platform/agent", "private": true, "main": "src/index.js" }` | M4 |
| `vite.config.js` (if needed) | `resolve.alias` for `@2d-platform/agent` if Vite doesn't auto-resolve the workspace | M4 |
| `tests/v29-workspace.spec.js` (new) | Asserts `npm test` passes after the M4 scaffolding | M4 |
| `packages/agent/src/*` | Move from `src/agent/*` (git mv preserves history) | M5 |
| `src/agent/` | **Deleted** | M5 |
| `src/main.js`, all Playwright specs | Update `import` paths from `./agent/...` (or `/src/agent/...`) to `@2d-platform/agent` (or `/packages/agent/src/...`) | M5 |
| `packages/agent/src/index.js` (new) | Public API exports per design §3.4: `testLevel`, `plan`, `simulate`, `renderSolutionOverlay`, etc. | M5 |
| `packages/agent/README.md` (new) | Public API docs + adapter contract sketch + usage example | M5 |
| `packages/agent/examples/headless.js` (new) | Standalone smoke — constructs a stub adapter, plans a trivial level | M5 |
| `tests/v29-package-smoke.spec.js` (new) | Asserts `@2d-platform/agent` is importable from the editor; `testLevel` returns a sensible shape | M5 |
| `TDDs/3_transcripts/version29_build.md` (new) | narrative | M6 |

## Milestone 1 — Adapter interface + jsAdapter

Pure scaffolding; no agent file is changed. The interface is set
up so M2's refactor has a target.

1. Audit pass (`grep -rn "PlaytestScene\|ScriptedInput\|TILE" src/agent/`):
   - simAction.js: imports PlaytestScene, ScriptedInput, TILE; calls
     `new PlaytestScene(...)`, `new ScriptedInput(...)`,
     `scene.setPlayerState`, `scene.update`, `scene.simFrame`, etc.
   - sim.js: imports PlaytestScene, ScriptedInput, TILE; same
     pattern.
   - grid.js, planner.js, perframe.js, actions.js, runner.js:
     just `TILE`.
   - overlay.js: nothing engine-related.

   Document the SceneHandle surface in `src/agent-adapter.js` as
   JSDoc.

2. Create `src/agent-adapter.js`:
   ```js
   import { PlaytestScene } from './play/playtestScene.js';
   import { ScriptedInput } from './play/scriptedInput.js';
   import { TILE } from './play/constants.js';

   /**
    * Physics adapter — the agent's only engine dependency. v29
    * carves out the agent into packages/agent/ and removes its
    * direct imports of src/play/*. The editor wires this in once.
    */
   export const jsAdapter = {
     TILE,
     makeScene(parsed, legend, tileset) {
       const fakeGame = { input: null, assets: { play() {} } };
       return new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
     },
     makeScriptedInput(recording) {
       return new ScriptedInput(recording);
     },
   };
   ```
3. `tests/v29-adapter.spec.js`:
   - `jsAdapter.TILE === 20`.
   - `jsAdapter.makeScene({...}, DEFAULT_LEGEND, null)` returns
     an object with `.enter`, `.update`, `.setPlayerState`,
     `.player`, `.coins`, `.phase`.
   - `jsAdapter.makeScriptedInput([])` returns an object with
     `.advance`, `.isDown`, `.wasPressed`, `.endFrame`.
4. Verify: `npm test`, `npx playwright test`.

```
git add src/agent-adapter.js tests/v29-adapter.spec.js
git commit -m "v29 m1: physics adapter scaffolding (jsAdapter)"
```

## Milestone 2 — simAction + sim consume the adapter

Refactor the leaf-level simulator modules. Their internal `new
PlaytestScene` / `new ScriptedInput` calls go through the adapter.
Callers (grid / planner / perframe / runner) keep their existing
sig — they'll be threaded in M3.

1. `src/agent/simAction.js`:
   - `makeSimContext(adapter, parsed, legend, tileset)` —
     adapter prepended to args. Internally:
     ```js
     const scene = adapter.makeScene(parsed, legend, tileset);
     // wire scene.game.input so we can swap ScriptedInputs per call
     scene.game = { input: null, assets: scene.game?.assets ?? { play() {} } };
     return { scene, adapter };
     ```
   - `simulateActionInContext(ctx, startState, action, opts)` —
     uses `ctx.adapter.makeScriptedInput(...)` instead of
     `new ScriptedInput(...)`.
   - `simulateAction({ adapter, parsed, ... })` — adapter via the
     opts bag.
2. `src/agent/sim.js`:
   - `simulate({ adapter, parsed, legend, tileset, recording, ... })`
     — adapter via opts. Same construction pattern via adapter.
3. **Temporary glue**: where the agent's callers haven't been
   updated yet (grid.js / planner.js / perframe.js / runner.js),
   pin `jsAdapter` via a top-of-file import:
   ```js
   // TEMPORARY (removed in M3): pin the JS adapter so old call
   // sites keep working until M3 threads adapter through.
   import { jsAdapter as _adapter } from '../agent-adapter.js';
   ```
   `grid.js`'s `makeSimContext` call passes `_adapter`. Likewise
   for the perframe `makeContextCache` path.
4. Update any direct callers in tests:
   - Node tests that call `simulateAction` directly → pass
     `adapter: jsAdapter` (or a stub).
5. Verify all 295 unit + 131 Playwright tests pass.

```
git commit -m "v29 m2: simAction + sim consume injected adapter"
```

## Milestone 3 — Planners thread adapter; main.js wires up jsAdapter

The public entries (`plan`, `testLevel`) gain a required
`opts.adapter`. The temporary glue from M2 is removed.

1. `src/agent/grid.js`:
   - `buildNavGraph(adapter, parsed, legend, tileset)` —
     adapter prepended. Pass through to `makeSimContext`.
   - `addActionEdges(ctx, ...)` already reads `ctx.adapter` (no
     change needed — ctx carries it from M2).
2. `src/agent/planner.js`:
   - `plan(parsed, legend, opts = {})` — `opts.adapter` is
     required (throw if missing). Pass through to
     `buildNavGraph` + `planPerFrame`.
   - `simContext` constructor — pass `opts.adapter`.
3. `src/agent/perframe.js`:
   - `planPerFrame(parsed, legend, tileset, opts)` — `opts.adapter`
     threaded into `expandNode` + `aStarPerFrame` + the
     `makeContextCache` flow.
   - `expandNode(cache, parsed, legend, tileset, state, opts)` —
     calls `getContext(cache, adapter, parsed, legend, tileset)`.
   - `getContext` — uses `adapter.makeScene` (was
     `makeSimContext` directly).
4. `src/agent/runner.js`:
   - `testLevel(parsed, legend, tileset, opts)` — `opts.adapter`
     required. Pass through to `plan`, `simulate`.
5. `src/main.js`:
   - `import { jsAdapter } from './agent-adapter.js';`
   - Every `testLevel(parsed, legend, tileset, opts)` call gets
     `{ adapter: jsAdapter, ...opts }`.
6. **Remove the M2 temporary glue** — the `import _adapter from`
   lines in grid/planner/perframe/runner go away.
7. **Adapter contract assertion**: at `plan` and `testLevel`'s
   top, throw if `opts.adapter?.TILE` differs from what the
   agent expects (the value the agent has compiled with — i.e.,
   `TILE` from `../play/constants.js` for now; M4 moves it).
8. Verify ALL agent-suite specs pass under the new threading:
   - tutorial.txt, simple.txt, above_ground.txt, below_ground.txt
   - tower-cherry, multi-pickup, multi-solution
   - bucket-graph specs (still call `buildNavGraph(adapter, ...)`)
9. Full Playwright agent-suite green.

```
git commit -m "v29 m3: thread adapter through grid + planner + perframe + runner"
```

## Milestone 4 — Agent owns its own TILE; workspace scaffolding

The agent stops importing `TILE` from `src/play/constants.js`.
Adds workspace metadata; `packages/agent/` exists but is empty
of agent code (M5 moves files).

1. `src/agent/constants.js` (new):
   ```js
   // v29 M4: agent's local engine-physics constants. Matches the
   // v9 §7 vendored engine. The adapter's TILE is verified to
   // match at plan() entry — if a Python (or other) adapter has
   // a different TILE, the agent will throw at the boundary.
   export const TILE = 20;
   ```
2. Every agent file currently importing `TILE` from
   `'../play/constants.js'`:
   ```diff
   -import { TILE } from '../play/constants.js';
   +import { TILE } from './constants.js';
   ```
   Files: grid.js, planner.js, perframe.js, actions.js, runner.js,
   simAction.js, sim.js.
3. **The adapter contract assertion (M3) reads from the local
   `TILE`** so the agent's expected value is self-contained.
4. `package.json` (root): add
   ```json
   "workspaces": ["packages/*"]
   ```
   No `devDependency` on the agent yet (files haven't moved).
5. `packages/agent/package.json`:
   ```json
   {
     "name": "@2d-platform/agent",
     "version": "0.0.0",
     "private": true,
     "main": "src/index.js",
     "type": "module"
   }
   ```
6. `vite.config.js`: if the dev server needs help resolving the
   workspace, add a `resolve.alias`. Otherwise no change.
7. `tests/v29-workspace.spec.js` (new):
   - Asserts `@2d-platform/agent` resolves from the workspace
     (after M5 this will pass via real exports; M4 it's a
     placeholder asserting the package.json is well-formed).
8. Verify `npm install` succeeds from a fresh checkout; tests
   green.

```
git commit -m "v29 m4: agent-local TILE + workspace scaffolding"
```

## Milestone 5 — Move files + public API + README + smoke test

The file move is mechanical — every M2-M4 milestone made the
agent engine-agnostic in-place, so M5 just relocates the files
and updates import paths.

1. `git mv src/agent/* packages/agent/src/` for every file
   (including the M4 `constants.js`).
2. `git rm -r src/agent` (empty directory).
3. Update import paths in the editor:
   - `src/main.js`: `from './agent/index.js'` → `from
     '@2d-platform/agent'`.
   - `src/main.js`: `from './agent/overlay.js'` → `from
     '@2d-platform/agent'` (overlay exports come from
     index.js).
4. Update Playwright spec imports:
   - `tests/*.spec.js`: `import('/src/agent/...')` → `import('/packages/agent/src/...')`.
5. `packages/agent/src/index.js` (new):
   ```js
   // Public API. Adapter must be passed via opts.adapter.
   export { testLevel } from './runner.js';
   export { plan, aStar } from './planner.js';
   export { planPerFrame } from './perframe.js';
   export { simulate } from './sim.js';
   export { buildNavGraph, stateKey, vxBucketOf, xOffsetBucketOf,
            VX_BUCKETS, X_OFFSET_BUCKETS } from './grid.js';
   export { enumerateActions, actionToRecording,
            WALK_FRAMES_PER_CELL, DROP_HOLD_FRAMES_BUDGET } from './actions.js';
   export { renderSolutionOverlay, renderAllSolutionsOverlay,
            HUE_PALETTE } from './overlay.js';
   export { TILE } from './constants.js';
   ```
6. `packages/agent/README.md` (new):
   ```markdown
   # @2d-platform/agent

   The 2D level-designer's planning agent. Carved out in v29 so
   alternate implementations (Python, MCP-callable) can plug in
   via a thin physics-adapter API.

   ## Usage

   ```js
   import { testLevel } from '@2d-platform/agent';
   import { jsAdapter } from '2d-level-designer/src/agent-adapter.js';

   const result = await testLevel(parsed, legend, tileset, {
     adapter: jsAdapter,
     maxRuntimeMs: 5000,
   });
   ```

   ## Physics adapter contract

   ...
   ```
7. `packages/agent/examples/headless.js` (new): standalone smoke
   that constructs a stub adapter and tests a tiny level. Runs
   via `node packages/agent/examples/headless.js` —
   demonstrates the agent in isolation.
8. `tests/v29-package-smoke.spec.js` (new): in the browser via
   Playwright `page.evaluate`, asserts `@2d-platform/agent`
   resolves and `testLevel(...)` with `jsAdapter` returns the
   expected shape.
9. Verify all 295 unit + 132+ Playwright pass.

```
git commit -m "v29 m5: move src/agent → packages/agent + public API + README + smoke"
```

## Milestone 6 — Acceptance + transcript + Delivered

1. `TDDs/3_transcripts/version29_build.md` (new): narrative covering:
   - The audit pass (what surface the agent actually uses).
   - The adapter interface as it ended up (which methods were
     added beyond the initial design sketch).
   - Where the threading was tricky (which signature changes
     reached how many call sites).
   - The TILE-mismatch contract — what happens if an adapter
     ships TILE=24 (the editor TILE, not the engine TILE) — and
     how the v29 assertion catches it.
   - The file move stats — `git mv` count, before-and-after
     line counts in editor `src/`.
   - Bundle-size delta if any.
   - The follow-up v30+ candidates: npm publish, sibling
     `@2d-platform/play` package, Python adapter implementation,
     MCP server.
2. Mark design + impl Delivered with the M1–M6 commit-hash table.

```
git commit -m "v29 m6: acceptance + v29 transcript; design + impl Delivered"
```

## Risks & sequencing

- **M2 missed surface area** — if a `scene.*` field or method
  the agent uses isn't exposed by the adapter, M2's refactor
  fails at test time. Mitigation: M1's audit pass + M2
  walks the same files updating call sites, will surface gaps
  immediately.
- **M3 signature churn touches many tests** — every spec that
  calls `plan` / `testLevel` directly via `page.evaluate` adds
  `adapter: jsAdapter` (or imports it). Mitigation: mechanical
  update; M3 milestone gate runs the full Playwright suite.
- **M4 TILE divergence** — if a test imports TILE from
  `../play/constants.js` and another from `./constants.js`, JS
  doesn't complain. Mitigation: the M3 contract assertion at
  `plan`/`testLevel` entry catches mismatched TILE values.
- **M5 Vite workspace resolution** — the dev server might not
  resolve `@2d-platform/agent` without help. Mitigation: M4
  workspace scaffolding milestone gates on `npm run dev` working;
  if Vite needs a `resolve.alias`, add it then.
- **M5 Playwright spec import paths** — the specs use absolute
  paths like `/src/agent/index.js`. These change to
  `/packages/agent/src/index.js`. Mitigation: mechanical sed
  pass; the Playwright gate catches anything missed.
- **No deploy risk** — bundle size unchanged in principle (same
  JS, different file paths). Verify at M5.
- **v9 §7 invariant**: the agent stops importing
  `src/play/playtestScene.js`, `src/play/scriptedInput.js`,
  `src/play/constants.js` after M4. The adapter (in
  `src/agent-adapter.js`, in the editor) is the only consumer
  of those files outside `main.js` / `renderer.js`. Crystal-clear
  separation.

## Deferred (design §9 → v30+)

- **Publish `@2d-platform/agent` to npm** with semver + release
  notes.
- **Carve out `@2d-platform/play`** containing the vendored
  engine + scene + entities. Both editor and agent would depend
  on it; current state has the editor still importing
  `src/play/*` directly via `agent-adapter.js`.
- **Python adapter implementation** — separate project consuming
  the same API shape via a Node ↔ Python bridge.
- **MCP server exposing the agent as callable tools**.
- All the long-standing UX items (theme listener, viewport
  guide, resizable legend, etc.).
- **Minimum-render-duration hook in agentDialog** — re-enables
  the v21 `searching state` Playwright spec skipped in v28 M3.
- **Retire `src/agent/index.js` deprecation shim** — not needed
  in v29 because there's no shim (atomic switch).
