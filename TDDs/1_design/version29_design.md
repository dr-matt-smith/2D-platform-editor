# 2D Level Designer — Version 29 Design Document

Status: Proposed · Date: 2026-05-25 · Builds on:
[version28_design.md](version28_design.md) (per-frame trajectory planner;
below_ground.txt solves) · Implementation: *to follow once this scope
is approved*.

## 1. Purpose

Single thread: **carve `src/agent/*` into a standalone workspace
package with an inverted physics-adapter API**. The first step
toward the user-stated direction in `__temp/open_to_other_agents.md`:

> Separate game playing agent into another project so we expose
> details about the level & play settings for interrogation to
> other agents. Test with a python version of the testing agent
> (as well as the JS one).

v22→v28 hardened the agent into a reliable solver
(below_ground.txt finally solves end-to-end). v29 makes that
solver consumable as a discrete module — not bound to this
editor's file layout, not implicitly dependent on the vendored
`src/play/*` engine.

### Scope shape

- **Workspace package** (`packages/agent/`) — not yet published to
  npm; `package.json` + `package-lock` set up for in-repo use via
  workspaces. Future v30+ can publish without restructuring.
- **Physics-adapter API** — the agent's only dependency on the
  play engine is an injected adapter object. Today the editor
  passes a JS adapter wrapping `PlaytestScene` + `ScriptedInput`.
  Tomorrow a Python adapter could plug in for the multi-language
  comparison the user mentioned.
- **v9 §7 invariant intact** — vendored upstream code stays in
  `src/play/core/*` + `src/play/entities/*` byte-identical. The
  agent package never imports them directly.

### Out of scope (proposed deferrals)

- **Publishing to npm** — workspace use only in v29. v30+ can add
  release automation.
- **Python adapter implementation** — v29 ships only the JS
  adapter + the slot where a Python adapter would plug in. The
  Python implementation is its own project.
- **MCP server / agent-callable tools** — the other open question
  from `open_to_other_agents.md`. Distinct effort; v30+ candidate.
- All the v28 §9 deferred items (theme listener, minimap, etc.) —
  unchanged; queued for later.

## 2. Current state

### Agent module structure (v28)

```
src/agent/
├── actions.js        46 candidate actions per cell
├── grid.js           cell-aware nav-graph + bucket A* helpers
├── grid.test.js
├── planner.js        bucket-aware A* + plan() public entry
├── planner.test.js
├── perframe.js       per-frame trajectory planner (v28 default)
├── simAction.js      per-action simulator wrapping PlaytestScene
├── sim.js            full simulation runner
├── runner.js         testLevel + replan loop
├── overlay.js        path overlay rendering (uses 2D canvas)
└── index.js          public testLevel API
```

### Cross-package imports (from `src/agent/*` outward)

```text
simAction.js   → src/play/playtestScene.js   (PlaytestScene class)
                src/play/scriptedInput.js   (ScriptedInput class)
sim.js         → src/play/playtestScene.js
                src/play/scriptedInput.js
grid.js        → src/play/constants.js       (TILE)
planner.js     → src/play/constants.js       (TILE)
actions.js     → src/play/constants.js       (TILE)
perframe.js    → src/play/constants.js       (TILE)
overlay.js     → none (pure 2D canvas calls)
runner.js      → src/play/constants.js       (TILE — via simulate's
                                               maxFrames calc)
```

Plus a few `import { TILE } from '../play/constants.js'` chains.

`level.js` is in `src/level.js` (not under `play/`); it's parsed
data the agent receives — fine to keep as an external input
(not an engine dep).

## 3. Architecture

### 3.1  Physics-adapter interface

The agent's only contract with the engine becomes an explicit
adapter object passed to public entry points:

```ts
interface PhysicsAdapter {
  TILE: number;

  // Construct a fresh playtest scene around a level. The returned
  // object exposes the minimum surface the agent's simulator uses.
  makeScene(parsed: ParsedLevel, legend: Legend, tileset?: any): SceneHandle;

  // Wrap a recording into a scripted input source.
  makeScriptedInput(recording: InputEvent[]): ScriptedInputHandle;
}

interface SceneHandle {
  // Engine update + state queries — covers everything simAction.js
  // and sim.js currently call on PlaytestScene.
  enter(): void;
  update(dt: number): void;
  setPlayerState(state: ExactState): void;
  readonly phase: 'play' | 'won' | 'dead';
  readonly score: number;
  readonly player: { x: number; y: number; vx: number; vy: number;
                     w: number; h: number; onGround: boolean };
  readonly coins: Array<{ collected: boolean; x: number; y: number;
                          w: number; h: number }>;
  // ... whatever other PlaytestScene members simAction/sim read
}

interface ScriptedInputHandle {
  advance(frame: number): void;
  isDown(key: string): boolean;
  wasPressed(key: string): boolean;
  endFrame(): void;
}
```

The full member list is determined by audit (M1): grep
`src/agent/*` for `.scene.*`, `.player.*`, `.coins.*`,
`input.*` reads, write the interface around the existing usage
without adding new methods.

### 3.2  Adapter package boundaries

Two files leak: the JS adapter (lives in `src/agent-adapter-js.js`
or similar in the editor) constructs `PlaytestScene` + bundles
`TILE` from `src/play/constants.js`. The agent never imports
these directly.

```text
packages/agent/
├── src/
│   ├── actions.js          (no engine import — pure)
│   ├── grid.js             (no engine import — TILE injected via adapter)
│   ├── planner.js          (no engine import)
│   ├── perframe.js         (no engine import)
│   ├── simAction.js        (uses adapter.makeScene, adapter.makeScriptedInput)
│   ├── sim.js              (uses adapter.makeScene, adapter.makeScriptedInput)
│   ├── runner.js           (uses adapter)
│   ├── overlay.js          (no engine import — pure canvas calls)
│   └── index.js            (public API)
├── tests/                  (the existing *.test.js + spec.js files,
│                            plus a minimum-stub adapter for tests)
├── package.json
└── README.md               (public API documentation)

src/
├── agent-adapter.js        (NEW — JS adapter wrapping PlaytestScene)
├── main.js                 (imports plan + testLevel from
│                            'packages/agent' via workspace)
├── play/...                (unchanged; v9 §7 byte-identical)
└── ...
```

### 3.3  Workspace setup

Root `package.json`:

```json
{
  "name": "2d-level-designer",
  "private": true,
  "workspaces": ["packages/*", "."]
}
```

Wait — the root IS the editor. Two options:

- **Option A: keep the editor at the repo root, agent under
  `packages/agent/`.** Workspaces list `["packages/*"]`. The
  editor's `package.json` adds `"@2d-platform/agent": "workspace:*"`.
- **Option B: move the editor to `packages/editor/`, root becomes
  pure workspaces shell.** Cleaner but bigger churn (Vite config,
  CI workflow, dist paths all move).

**Proposed: Option A.** Smaller diff; the editor's relative paths
(public/, dist/, build:pages workflow) stay where they are.

### 3.4  Public API

```js
// packages/agent/src/index.js
export {
  // Top-level — what the editor calls.
  testLevel,                 // (parsed, legend, tileset?, opts?) => Promise<TestResult>
  plan,                      // (parsed, legend, opts?) => Plan

  // Plan-rendering helpers (for the editor's overlay).
  renderSolutionOverlay,
  renderAllSolutionsOverlay,
  HUE_PALETTE,

  // Sub-planners — exposed for diagnostics + tests.
  planPerFrame,              // alias of plan with opts.planner='perframe'

  // Internals exposed for tests + introspection (treat as
  // semi-public; v30 may stabilise).
  simulate,                  // full-replay runner used by tests
  buildNavGraph,             // legacy bucket-graph builder
  enumerateActions,
};
```

`opts` gains `adapter: PhysicsAdapter` — required.

### 3.5  Editor wire-up

`src/agent-adapter.js` (new):

```js
import { PlaytestScene } from './play/playtestScene.js';
import { ScriptedInput } from './play/scriptedInput.js';
import { TILE } from './play/constants.js';

export const jsAdapter = {
  TILE,
  makeScene(parsed, legend, tileset) {
    const fakeGame = { input: null, assets: { play() {} } };
    const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
    return scene;     // PlaytestScene already exposes the right surface
  },
  makeScriptedInput(recording) {
    return new ScriptedInput(recording);
  },
};
```

`src/main.js`:

```diff
-import { testLevel } from './agent/index.js';
-import { renderSolutionOverlay, renderAllSolutionsOverlay } from './agent/overlay.js';
+import { testLevel, renderSolutionOverlay, renderAllSolutionsOverlay } from '@2d-platform/agent';
+import { jsAdapter } from './agent-adapter.js';
```

Calls update from `testLevel(parsed, legend, tileset, opts)` to
`testLevel(parsed, legend, tileset, { adapter: jsAdapter, ...opts })`.
The `tileset` arg passes through to the adapter's `makeScene`.

### 3.6  Tests

The agent's existing tests (`*.test.js` for Node, `*.spec.js` for
Playwright) need an adapter. For Node tests:

```js
// packages/agent/tests/stub-adapter.js
// Minimum adapter for unit tests — uses a fake-PlaytestScene that
// records calls without actually integrating physics. Or imports
// the real PlaytestScene from src/play (cross-package relative
// import is allowed in workspaces).
```

The Playwright specs use the actual webapp via `page.evaluate(...)`
— no change needed; they exercise the editor's wired-up `jsAdapter`.

## 4. UX in detail

### 4.1  No user-visible change

The editor's Test / Demo / Play flows behave identically to v28.
The agent dialog, path overlay, multi-solution display, badge
states — all unchanged.

The only observable difference: `npm install` after this commit
needs to set up the workspace (or `npm install --workspaces`),
and the build is a touch more complex. Both are documented in
the README updates.

### 4.2  Developer-facing change

A new developer can now use the agent in isolation:

```js
import { testLevel } from '@2d-platform/agent';
import { jsAdapter } from '2d-level-designer/src/agent-adapter.js';
// or roll their own adapter

const result = await testLevel(parsed, legend, tileset, { adapter: jsAdapter });
```

Sets up the v30+ direction of "Python agent": same API, different
adapter.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `packages/agent/package.json` (new) | Workspace package metadata; main = `src/index.js` |
| `packages/agent/README.md` (new) | Public API documentation + the physics-adapter interface contract |
| `packages/agent/src/*` (new) | Files moved from `src/agent/*`. `import` paths updated to use the adapter instead of `../play/...` |
| `packages/agent/tests/*` (new) | The existing `src/agent/*.test.js` plus `tests/v2[1-8]-*.spec.js` files moved here. Adapter stub added for Node tests |
| `src/agent/*` | **Deleted.** Re-exports could be left in `src/agent/index.js` for one cycle as a deprecation shim — proposed: delete outright since the editor's imports update in the same commit |
| `src/agent-adapter.js` (new) | JS adapter wrapping PlaytestScene + ScriptedInput + TILE |
| `src/main.js` | Import path update; pass `adapter: jsAdapter` through `testLevel` calls |
| `src/main.js` | Same for `renderSolutionOverlay` / `renderAllSolutionsOverlay` import |
| `package.json` (root) | Add `"workspaces": ["packages/*"]` and devDependency on `@2d-platform/agent: "workspace:*"` |
| `tests/v2[1-8]-*.spec.js` | Specs that `import('/src/agent/...')` update to `import('/packages/agent/src/...')` — Vite serves workspace packages relative to root |
| `vite.config.js` | If needed: `resolve.alias` for `@2d-platform/agent` → `packages/agent/src/index.js` |
| `TDDs/3_transcripts/version29_build.md` (new) | narrative |

## 6. Open questions — proposed defaults

- **Package name**: `@2d-platform/agent` vs `2d-platform-agent` vs
  `level-designer-agent`. **Proposed: `@2d-platform/agent`** — the
  scope leaves room for a sibling `@2d-platform/play` package if
  v30 carves out the engine too.
- **Workspace root structure**: Option A (editor at root, agent
  under packages/) vs Option B (editor moved into packages/editor/).
  **Proposed: Option A**. Smaller diff.
- **Adapter required, or optional with a default?**: requiring it
  forces every caller to be explicit (good for clarity); optional
  with a JS default lets the editor's existing call sites work
  unchanged. **Proposed: required.** Forces the editor to wire up
  `jsAdapter` once and makes the engine dependency explicit.
- **Deprecation shim at `src/agent/`**: leave a re-export so
  in-flight branches don't break, or delete outright? **Proposed:
  delete outright.** No in-flight branches reported; the rewrite
  is atomic.
- **Public API surface**: which internals to export? `enumerateActions`
  and `buildNavGraph` are used by some tests. **Proposed: export
  them** — labelled "semi-public" in the README.
- **`overlay.js` lives in agent or editor?** It depends on a 2D
  canvas (no engine). **Proposed: stay in agent** — it's
  agent-output rendering; co-located with the planner.

## 7. Acceptance criteria

### Build + test
- `npm install` from a fresh checkout sets up the workspace.
- `npm test` green — all 295 unit cases continue to pass.
- `npx playwright test` green — all 131 Playwright cases (+1
  skipped) continue to pass.
- `npm run build` clean.
- `npm run build:pages` clean.

### Agent in isolation
- A new file `packages/agent/examples/headless.js` (or a smoke
  test in `packages/agent/tests/`) constructs a stub adapter and
  calls `testLevel(parsed, legend, null, { adapter: stub })` —
  returns a sensible result on a trivial level.

### Editor still works
- All v21–v28 user-visible behaviour is unchanged (Test, Demo,
  Play, fit toggle, theme, HUD band, etc.).
- below_ground.txt continues to solve end-to-end.

### API ergonomics
- `packages/agent/README.md` shows the canonical "import + call"
  example matching the §4.2 sketch.

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **Tileset schema** — unchanged.
- **HUD band, scrollbar-gutter, theme palette** (v27) — unchanged.
- **Per-frame planner default + bucket fallback** (v28) — unchanged.
- **Public agent API contract** (testLevel signature, plan
  signature, returned shapes) — extended by one required `opts.adapter`
  field; existing fields unchanged.

## 9. v30+ candidates / deferred

- **Publish `@2d-platform/agent` to npm** with semver + release
  notes.
- **Carve out a `@2d-platform/play` package** containing the
  vendored engine + scene + entities; both editor and agent
  depend on it. Would reduce duplication if the agent ever
  vendors its own copies.
- **Python adapter** — separate project; consumes the same API
  shape via a JS bridge (Node ↔ Python IPC) or a WASM build.
- **MCP server exposing the agent** as callable tools — separate
  effort; uses the now-package agent.
- **Reactive theme listener** (OS-pref flips mid-session).
- **`prefers-color-scheme` first-load default**.
- **Viewport guide follows mouse**.
- **Author-resizable legend width** + drag-and-drop reorder +
  per-tileset persistence.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles** (engine change).
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.
- **Update legacy tilesets for v22.1 `imageLocked`**.
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval.
- **Minimum-render-duration hook in agentDialog** — re-enables
  the v21 `searching state` Playwright spec skipped in v28 M3.

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **Import-path churn**: every spec that imports from
  `/src/agent/...` needs updating. Mitigation: mechanical sed
  pass + the test suite catches anything missed at the gate.
- **Adapter interface gaps**: the SceneHandle interface might
  miss a method `sim.js` or `simAction.js` calls. Mitigation: M1
  is an audit pass — grep for every `.scene.*` / `.player.*` /
  `.coins.*` / `.input.*` read in the agent and codify the
  interface around exact usage.
- **Vite workspace resolution**: workspace packages sometimes
  need `vite.config.js` `resolve.alias` or `optimizeDeps.include`
  tweaks. Mitigation: M3 is a "wire up the workspace + verify
  dev server + verify build" milestone — fix Vite quirks before
  M4 moves the files.
- **Test discovery**: Playwright's `playwright.config.js` looks
  in `tests/` by default. Specs that move to
  `packages/agent/tests/` need either a config update or to
  stay in `tests/`. **Proposed**: Playwright specs stay in
  `tests/`; the Node `*.test.js` files move with the agent
  (Node's `--test` finds them via glob).
- **Build-pages workflow**: `npm run build:pages` is the CI
  workflow's deploy step. If workspaces break the build, the
  deploy breaks. Mitigation: run `build:pages` locally at every
  milestone gate.
- **v9 §7 invariant**: the agent never directly imports
  `src/play/core/*` or `src/play/entities/*`. The adapter does,
  inside the editor. Crystal-clear separation.
- **No deploy risk**: bundle size unchanged (the agent code is
  the same JS, just resolved via workspace). Bundle layout may
  differ — check `dist/assets/index-*.js` size at M5.
