# Version 20 — Implementation Plan

Status: **Delivered (M1–M6)** · Date: 2026-05-21 · Design:
[../1_design/version20_design.md](../1_design/version20_design.md) ·
Transcript: [../3_transcripts/version20_build.md](../3_transcripts/version20_build.md)

Delivered, one path-scoped commit per milestone (user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out throughout; the M5 commit caught
an IDE-pre-staged SynnyLand draft and un-staged it cleanly — see
the v20 transcript for the [[scoped-git-add]] discipline note):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `75fbb58` | `src/play/scriptedInput.js` (Input look-alike) + `src/agent/sim.js` (headless PlaytestScene runner, ~50ms per 10-sim-second budget) + 11 unit cases |
| 2 | `b5505a0` | `src/agent/grid.js` — nav-graph with walk/drop/jump edges; reach envelope (8h × 4v cells) derived from engine constants; 11 unit cases |
| 3 | `1ba3691` | `src/agent/planner.js` — A* + greedy pickup ordering + explainable trace with `why:` strings + `replan()` for blocked-edge retry; 11 unit cases |
| 4 | `e51783b` | `src/agent/runner.js` + `index.js` — plan/sim/replan orchestrator (budget 3); 5 unit cases; planner fix (frame starts at 1 to give player a settle tick) |
| 5 | `200f538` | UI: `[Test]` toolbar button + `src/agentDialog.js` + `src/agent/overlay.js` polyline + launcher's optional `inputSource` for demo mode + `body.demomode` toolbar swap + warm-yellow stage glow |
| 6 | _this commit_ | `tests/agent-test-button.spec.js` (4 e2e cases: solvable, overlay paints, Demo auto-exit, unreachable) + v20 transcript + design + impl Delivered |

Outcome: 217 → 257 unit tests (+40 agent cases). Playwright 6 → 7
(new agent-test-button spec; six pre-v20 specs unchanged). Both
builds clean. The v9 §7 byte-identical-to-upstream invariant for
`src/play/core/*` + `src/play/entities/*` preserved across all
six commits.

Six small path-scoped commits. The agent splits cleanly along
simulator → grid → planner → runner → UI → docs lines, so each
milestone can land independently and roll back on its own.

## Process (same discipline as v8–v19)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` before every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/wish_list.md` / IDE-pre-staged tileset
  drafts (SynnyLand, IncaTiles updates, etc.) stay out. The v19 M4
  IncaTiles incident is the cautionary tale: verify the index, not
  just my own `add` line.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  vendored files is preserved.** v20 doesn't touch any of
  `src/play/core/*` or `src/play/entities/*`. The new
  `src/play/scriptedInput.js` is v9-original-glue level (a sibling
  of the editor sources, not vendored upstream); `playtestScene.js`
  + `launcher.js` are v9-original-glue (also not vendored).

## Constraints & approach

- **Back-compat is the gate** at every milestone:
  - `Input` (vendored) is untouched; the new `ScriptedInput` is a
    structural look-alike with `wasPressed(key)` + `isDown(key)`.
    `PlaytestScene` consumes either via duck-typing.
  - `launcher.launchPlaytest` gains an optional `inputSource`
    param; omitting it means the v18+v19 keyboard path runs
    exactly as today (all existing e2e specs untouched).
  - The agent's modules (`src/agent/*`) are **pure** — DOM-free,
    no canvas reads, no `performance.now()`. The simulator runs
    deterministically across browsers and Node.
- **Schema: ZERO additions.** v20 doesn't write any header
  directive into the buffer; solutions are in-memory only.
- **Engine physics constants** are read from `src/play/constants.js`
  at agent startup (`SPEED`, `JUMP_FORCE`, `GRAVITY`). If those
  constants change, the agent's reach values update mechanically
  (no hand-tuning).

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/play/scriptedInput.js` (new) | Input look-alike: `new ScriptedInput(recording)` → `{ wasPressed, isDown, advance(frame), dispose }`. `recording` is an array of `{ frame, key, down }` events; `advance(frame)` walks the recording to update internal key state | M1 |
| `src/agent/sim.js` (new) | `simulate({ parsed, legend, tileset, recording, maxFrames })` → `{ outcome: 'won'\|'dead'\|'timeout', frame, score, pos? }`. Mints a fake `Game = { input, assets: { play(){} } }`, runs `PlaytestScene.update(1/60)` in a loop, returns when `scene.phase` transitions or `maxFrames` reached | M1 |
| `src/agent/sim.test.js` (new) | Unit cases: walk-right reaches exit; fall into pit → dead; touch spike → dead; collect-all → won; timeout when no input; ScriptedInput edge cases (empty recording, multi-key) | M1 |
| `src/agent/grid.js` (new) | `buildNavGraph(parsed, legend)` → `{ nodes: Map, edges: Map }`. Cells are nodes if they're `.` or `o` (walkable / pickupable); edges are walk (horizontal neighbours, both supported), drop (off-ledge with arc), jump (reachable from a grounded cell within ~8h × ~5v cells, gated by line-of-flight collision); also surfaces `start`, `pickupCells`, `exitCells` | M2 |
| `src/agent/grid.test.js` (new) | Unit cases: walk-edge between supported neighbours; no edge across a hazard; jump edges within reach; jump edges blocked by overhead `#`; drop edges from edge of platform; start/exit/pickup extraction | M2 |
| `src/agent/planner.js` (new) | `plan(parsed, legend)` → `{ trace, recording, stats }`. Greedy pickup ordering (nearest-first by A* cost) when `# pickup-required:` says so. A* per leg over the nav-graph. Trace entry shape: `{ kind, target, why, frameRange }`. `recording` is a frame-indexed input sequence derived from the trace. Also exports `replan(plan, simResult)` that marks the failing edge as ∞-cost and re-runs A* | M3 |
| `src/agent/planner.test.js` (new) | Unit cases: trivial level (walk right) → trace has one walk entry; level with one pickup → trace has collect + walk + exit; pickup-required: 2 of 3 → trace visits exactly 2 by greedy nearest order; unreachable exit → plan.recording.length === 0; trace `why:` strings populated | M3 |
| `src/agent/runner.js` (new) | `testLevel(parsed, legend, tileset, opts = {})` → `{ ok: true, solution } \| { ok: false, lastSim, plan }`. Orchestrates: `plan` → `simulate(recording)` → if `outcome === 'won'` return; else `replan` and retry up to `opts.replanBudget ?? 3` | M4 |
| `src/agent/index.js` (new) | Public re-export: `testLevel`, plus the typed shapes for the dialog | M4 |
| `src/agent/runner.test.js` (new) | Unit cases: solvable level → ok=true; unreachable level → ok=false + last position surfaced; replan triggered on physics fail | M4 |
| `src/agent/overlay.js` (new) | `renderSolutionOverlay(ctx, solution, parsed, tile)` paints the polyline + numbered markers + start marker. Pure: takes a ctx, draws, returns nothing | M5 |
| `src/agentDialog.js` (new) | `openAgentDialog({ solution, parsed, onDemo, onClose })` modal — mirrors `openPlaySettings` shape. Renders success/failure state, trace list, [Demo] button per solution row (v20: 1 row) | M5 |
| `src/play/launcher.js` | gains optional `inputSource` param: when `Array.isArray(inputSource)`, the launcher instantiates `ScriptedInput(inputSource)` instead of `Input`; otherwise the v18+v19 keyboard path runs unchanged | M5 |
| `src/main.js` | new `[Test]` toolbar button (edit-only, between Play and Play Settings); click handler runs `testLevel`, opens dialog, paints overlay; new `tryDemoPlaytest(recording)` mirrors `tryPlaytest` but flips on `body.demomode` and calls `launchPlaytest(..., { inputSource: recording })`; Esc exits demo back to the dialog | M5 |
| `src/style.css` | agent-dialog rows (`.agent-dialog .trace-list` / `.solution-row` / `.stat-pill`); overlay-active gate for the marquee; `[Test]` toolbar styling; `body.demomode` toolbar swap (mirrors `body.playmode`) | M5 |
| `tests/agent-test-button.spec.js` (new) | Playwright: click `[Test]` on the default level, modal opens with "Level completable", trace list non-empty, polyline visible on `#overlay`, click Demo, `body.demomode` set, eventually `phase === 'won'`, demo auto-exits | M6 |
| `TDDs/3_transcripts/version20_build.md` (new) | narrative, v8–v19 style | M6 |

## Milestone 1 — Headless simulator (pure, tested)

1. `src/play/scriptedInput.js`:
   - Class with the v9 `Input` shape: `wasPressed(key)` (consumes
     a one-frame edge), `isDown(key)` (continuous), `advance(frame)`
     (called once per simulator tick to walk the recording timeline),
     `dispose()` (no-op).
   - Recording shape: `[{ frame, key, down }]` — sorted by frame.
2. `src/agent/sim.js`:
   - `simulate({ parsed, legend, tileset, recording, maxFrames = 600 })`.
   - Mints `fakeGame = { input: new ScriptedInput(recording), assets: { play() {} } }`.
   - `new PlaytestScene(fakeGame, parsed, legend, tileset, () => {})`.
   - `scene.enter()` (calls `restart()` internally).
   - Loop: `scene.update(1/60)` for up to `maxFrames` iterations,
     advancing input each tick.
   - Returns the outcome at the first phase transition (or timeout).
3. `src/agent/sim.test.js`: 6+ unit cases. Trivial 3×3 level
   (`###\n#PE#\n###` — adjacent walk to exit) is the smoke case.
4. **No behaviour change** in the live editor — nothing imports
   sim yet.

Commit: `v20 m1: agent simulator + ScriptedInput (tested)`.

## Milestone 2 — Nav-graph

1. `src/agent/grid.js`:
   - `buildNavGraph(parsed, legend)`:
     - Nodes: every cell that is NOT `#` and NOT `^` (walkable
       or passable).
     - Edge: `walk` between supported (grounded) horizontal
       neighbours.
     - Edge: `drop` from a grounded cell to a non-grounded
       neighbour with vertical fall (computed via the same
       physics constants as the agent's jump-reach).
     - Edge: `jump` from a grounded cell to any other cell
       within the agent's reach envelope (~8 horizontal, ~5
       vertical), where the parabolic flight path doesn't
       intersect any `#`.
   - Reach envelope computed once from `SPEED` + `JUMP_FORCE` +
     `GRAVITY` constants.
   - Returns `{ nodes, edges, start, pickupCells, exitCells }`.
2. `src/agent/grid.test.js`: ~8 unit cases per the module map.
3. **No behaviour change** in the live editor.

Commit: `v20 m2: nav-graph (walk/drop/jump edges, physics-derived reach)`.

## Milestone 3 — Planner

1. `src/agent/planner.js`:
   - `plan(parsed, legend)`:
     - Build the nav-graph.
     - Determine the goal queue: pickup-required levels first
       visit pickups (greedy nearest-first by A* cost), then the
       exit; pickup-required `0` levels skip pickups entirely.
     - A* between consecutive goals over the nav-graph.
     - Construct the trace: per A* edge, add a trace entry with
       `kind` from the edge type, `target` (the destination cell),
       `why:` (a string per the design's examples), and
       `frameRange` (derived from the cumulative edge costs).
     - Construct the input recording from the trace: walk edges
       become "hold ArrowLeft/Right for N frames", jump edges
       become a single Space keypress + the underlying walk
       commitment.
   - `replan(plan, simResult)`:
     - Identify the edge that contained `simResult.pos` (or the
       last successfully-traversed edge before it).
     - Mark that edge ∞-cost.
     - Re-run plan with the updated graph.
2. `src/agent/planner.test.js`: 6+ unit cases.
3. **No behaviour change** in the live editor.

Commit: `v20 m3: planner — A* + greedy pickup ordering + explainable trace`.

## Milestone 4 — Runner

1. `src/agent/runner.js`:
   - `testLevel(parsed, legend, tileset, opts = {})`:
     - `let plan = planner.plan(parsed, legend);`
     - Loop up to `opts.replanBudget ?? 3`:
       - `const sim = simulate({ parsed, legend, tileset, recording: plan.recording });`
       - On `outcome === 'won'` → return
         `{ ok: true, solution: { plan, recording: plan.recording, stats: { ...sim, attempts: i + 1 } } }`.
       - Else `plan = planner.replan(plan, sim);`
     - Out of budget → return `{ ok: false, lastSim, plan }`.
2. `src/agent/index.js` re-exports `testLevel`.
3. `src/agent/runner.test.js`: ~4 unit cases.
4. **No behaviour change** in the live editor.

Commit: `v20 m4: runner — plan/sim/replan orchestrator`.

## Milestone 5 — UI integration

1. `src/play/launcher.js`:
   - `launchPlaytest(parsed, legend, tileset, canvas, opts = {})`:
     - When `opts.inputSource` is an array, instantiate
       `new ScriptedInput(opts.inputSource)`; otherwise
       `new Input()` (the v18+v19 path).
     - Demo runs in the same Game/Scene path as a normal
       playtest — only the input source differs.
2. `src/agent/overlay.js`:
   - `renderSolutionOverlay(ctx, solution, parsed, tile)`:
     polyline + numbered markers; the function expects the canvas
     dims to already match the editor's intrinsic.
3. `src/agentDialog.js`:
   - `openAgentDialog({ solution | failure, parsed, onDemo, onClose })`.
   - Solution state: header pill with stats, trace list, single
     `[Demo this route]` button per solution row (v20: 1 row).
   - Failure state: "No solution found within budget" + last-pos
     diagnostic.
4. `src/main.js`:
   - New `[Test]` toolbar button between `[Play]` and `[Play
     Settings]`, with `.edit-only` class.
   - Click handler:
     1. Run `testLevel(parse(src.value), legend, tileset)` (in a
        `setTimeout(..., 0)` so the "Searching…" can repaint
        first).
     2. On result, paint overlay (if `ok`) then open the dialog.
   - `tryDemoPlaytest(recording)`:
     - Sets `editorMode = 'demo'` + `body.classList.add('demomode')`.
     - Calls `launchPlaytest(parsed, legend, tileset,
       previewCanvas, { inputSource: recording })`.
     - Esc binding (capture-phase) exits demo back to the dialog
       (not to edit mode).
5. `src/style.css`:
   - `.agent-dialog` (mirrors `.play-settings`).
   - `.trace-list` + `.trace-entry` styles.
   - `body.demomode` toolbar swap (mirrors `body.playmode`).
6. **Visible after this commit**: the full feature works on the
   live deploy. `[Test]` → "Searching…" → modal → trace + Demo →
   the player visibly walks/jumps the agent's plan.

Commit: `v20 m5: UI — [Test] button + dialog + path overlay + demo mode`.

## Milestone 6 — e2e spec + docs + Delivered

1. `tests/agent-test-button.spec.js`:
   - Open the default level, click `[Test]`, wait for modal
     `.agent-dialog`, assert it shows "Level completable", the
     trace list has ≥1 entry, the `#overlay` canvas has non-zero
     paint (hash of the overlay's image data differs from the
     edit-mode baseline).
   - Click `[Demo this route]`, wait for `body.classList.contains
     ('demomode')`, then wait for it to be removed (= demo auto-
     exited on win); assert the playthrough completed.
2. `TDDs/3_transcripts/version20_build.md`: narrative; the
   architectural calls (headless sim as the validation backbone,
   hard-coded physics constants for the agent's reach, the
   schema-zero choice, the path-overlay reusability for v21+
   multi-solution).
3. Mark design + impl Delivered with the M1–M6 commit-hash table.

Commit: `v20 m6: agent e2e + v20 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is pure + standalone.** The simulator runs `PlaytestScene`
  but never touches a canvas; `node --test` covers it without a
  DOM. The fakeGame stub is the only new dependency direction.
- **M2 is pure + standalone.** The nav-graph reads parsed cells
  + the legend; no engine state, no rendering.
- **M3 has the most algorithmic surface.** Risk: A* edge cases on
  worlds with pickup-required > 0 and no path that touches enough
  pickups. Mitigation: greedy ordering bottoms out (if no pickup
  is reachable, plan returns an empty trace and runner reports
  `ok: false` immediately).
- **M4 is glue.** Runner risk is replan logic: marking the right
  edge as ∞-cost. Mitigation: the simulator surfaces `pos`
  (player position at the failure frame); planner.replan locates
  the trace entry whose `frameRange` contains the failure frame.
- **M5 is the integration milestone** — most visible. Risk: the
  agent's "Searching…" blocks the UI if `testLevel` is
  synchronous and the level is large. Mitigation: wrap the call
  in a `setTimeout(..., 0)` after rendering "Searching…"; if a
  user reports laggy levels in practice, a Web Worker is the
  v21 escalation. Demo mode risk: ScriptedInput timing drift if
  the live engine ticks at <60 fps. Mitigation: documented in
  design §15; the simulator's timing is the ground truth.
- **M6 adds one e2e spec.** Playwright suite grows 6 → 7.
- **No deploy risk.** Bundle grows by ~5KB; Pages workflow
  unchanged.

## Deferred (design §14 → v21+)

- **Multi-solution enumeration** — the UI is already a list to
  make this trivial; the planner gains a "find K best routes"
  path.
- **TSP-optimal pickup ordering** — greedy is v20.
- **Learning physics empirically** — v20 hard-codes from
  `constants.js`.
- **Backtracking around walls** (collect-key-then-return) — v22+.
- **Author-difficulty rating** — composite score visible in the
  dialog.
- **Web Worker for big-world A*** — if perceived performance
  needs it.
- **Multi-level cross-agent** (with v21+ doors / tunnels
  feature) — far future.
- All v18 + v19 long-standing carry-overs still pending (camera
  damping, parallax backgrounds, decoration-image placement,
  layered z-order, multi-row tile atlases, state-changing exit,
  the v17 dead-end caretLineCol cleanup, etc.).
