# Version 21 — Implementation Plan

Status: Proposed · Date: 2026-05-22 · Design:
[../1_design/version21_design.md](../1_design/version21_design.md)

Six small path-scoped commits. The headline architectural shift —
**action-sequence edges built by per-edge simulation** — splits
cleanly along action-taxonomy → per-action sim → graph builder →
A* planner → UI polish → docs lines.

## Process (same discipline as v8–v20)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit**; path-scoped `git add` only.
  Externally-staged files get `git restore --staged`-ed first. The
  v19 M4 IncaTiles incident and v20 M5 SynnyLand recovery are the
  cautionary tales.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  vendored files is preserved.** v21 touches `src/agent/*` and one
  small extension to `src/play/playtestScene.js` (a `setPlayerState`
  override hook, v9-original glue — not vendored upstream).

## Constraints & approach

- **Back-compat is the gate** at every milestone:
  - The agent's public entry `testLevel(parsed, legend, tileset)`
    keeps the same return shape (`{ok, solution: {plan, recording,
    stats}}` or `{ok: false, lastPlan, lastSim, attempts}`). The
    dialog reads the same fields; no UI changes are forced.
  - The `Solution.recording` shape (frame-indexed input events) is
    unchanged; Demo mode replays it identically.
  - All v20-solvable levels continue solving. The `agent-test-
    button` Playwright spec passes unchanged.
- **Edges are correct-by-construction.** The graph builder is the
  only place that runs `simAction`; downstream planner code can
  trust that every edge in the graph represents a physically-valid
  move.
- **Final validation pass kept as a safety net.** `runner.js`
  still drives `plan → simulate-full → replan` — but with the
  new edge accuracy, replans should fire only on floating-point
  edge cases. `replanBudget` returns to 3.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/agent/actions.js` (new) | Action-kind taxonomy: `walk{dir,cells}` / `jump{dir,holdFrames}` / `drop{dir,cells}` / `wait{frames}`. Pure helpers: `enumerateActions(cell, grid)` yields candidate (kind, params) tuples per grounded cell; `actionToRecording(action, frameStart)` converts an action to ScriptedInput events; `actionToWhy(action, subgoalName)` produces the `why:` string for the trace | M1 |
| `src/agent/actions.test.js` (new) | Unit cases: walk produces N-cell-cost events; jump emits space-press + direction-hold for holdFrames + release; drop emits direction-hold + no space; wait emits nothing; actionToWhy populates release-frame info naturally | M1 |
| `src/agent/simAction.js` (new) | `simulateAction({parsed, legend, tileset, startState, action})` runs `PlaytestScene` from a forced initial state through the action's duration; returns `{outcome, endCell, endPos:{xPx,yPx}, endVel:{vx,vy}, collided}`. Uses ScriptedInput for the action's keypress sequence; reads ground truth from engine physics | M2 |
| `src/play/playtestScene.js` | New `setPlayerState({x, y, vx, vy, onGround})` method — overrides the player's AABB + velocity after `enter()`. v9-original glue, not vendored upstream. Used only by simAction; the live launcher path doesn't call it | M2 |
| `src/agent/simAction.test.js` (new) | Unit cases: walk_right lands one cell right at expected frame; jump_right_release_at_full lands at full arc distance; jump_right_release_at_8 lands at shorter horizontal (release truncates vx); collision against a wall sets collided=true; sub-pixel start position survives a round-trip | M2 |
| `src/agent/grid.js` | Major rewrite of `buildNavGraph` and `addJumpEdges` / `addWalkEdges` / `addDropEdges`. Each grounded cell enumerates ~30 candidate actions via `enumerateActions`, runs `simulateAction` for each, adds edges only for non-colliding actions ending on grounded cells in-bounds. Each edge carries `recording`, `endCell`, `endPos`, `endVel`. The v20.1 `maxDcForDr` + `isParabolaClear` retained as **prefilter** (skip obviously-impossible actions before running the full sim) | M3 |
| `src/agent/grid.test.js` | Existing tests reviewed: walk-edge / jump-edge / drop-edge assertions checked against the new model; tests asserting cell-pair edge counts may need update; new cases for action-edges (each edge has recording + endPos + endVel) | M3 |
| `src/agent/planner.js` | A* node identifier extended from `"r,c"` to `"r,c|vyBucket"` where vyBucket = 0 (grounded) or 1 (mid-fall). Trace entries' `target` becomes `endCell`; new fields `endPos` + `release` (release-frame for jumps); recording concatenation uses each edge's pre-built `recording` instead of synthesizing from kind. `replan` semantics unchanged | M4 |
| `src/agent/planner.test.js` | Existing tests reviewed; some may need expected-trace updates (richer entries); new cases for release-frame planning (a level requiring release-at-N picks the right N) | M4 |
| `src/agent/runner.js` | Becomes async: yields periodically so the UI countdown can repaint. New `maxRuntimeMs` option (default 5000); replaces the v20.1 hard `replanBudget=10` cap with an elapsed-time check. `onProgress(elapsed, totalMs)` callback fires at each yield point. When time permits, retries with alternate goal-ordering variants. `maxFrames` (per-sim) stays at 1200 | M4 |
| `src/agent/overlay.js` | Polyline uses each trace entry's `endPos` (pixel-precise). Jump segments interpolate the parabola at 6 intermediate frames (smooth arc instead of straight line). Numbered markers unchanged | M5 |
| `src/agentDialog.js` | New "searching" state: opens immediately with countdown `<output>` + cancel; transitions to success/failure when the runner resolves. Failure renders three escalation buttons (`[Try 10s] [Try 15s] [Try 20s]`) below the diagnostic, each re-invoking `testLevel` with the new budget. Trace renderer's `why:` string formatting reads action params: e.g. "jump right (release at frame 26) toward pickup #2 at (5,8)". | M5 |
| `src/main.js` | `#testBtn` handler updates: opens the dialog in `searching` state immediately, then awaits `testLevel(..., {maxRuntimeMs: 5000, onProgress})` and updates the dialog. The onProgress callback ticks the countdown. Escalation callbacks rerun with 10/15/20s budgets | M5 |
| `src/style.css` | New `.agent-dialog .countdown` (big monospace number), `.agent-dialog .escalation-row` (three side-by-side buttons), and a faint progress-bar `.agent-dialog .countdown-bar` rendered as a `<progress>` element | M5 |
| `tests/agent-test-button.spec.js` | Existing 4 cases unchanged. New cases: tutorial.txt solves end-to-end; the user's tower-cherry level solves; demo replay reaches `phase=won` within predicted frame ±2 | M6 |
| `TDDs/3_transcripts/version21_build.md` (new) | narrative, v8–v20 style | M6 |

## Milestone 1 — Action taxonomy (pure, tested)

1. `src/agent/actions.js`:
   - Export action-kind tags + JSDoc on each param shape.
   - `enumerateActions(cell, grid)`:
     - Walks left/right by 1..MAX_WALK cells (where each cell is
       grounded). Filtered by adjacency + grounded-floor.
     - Jumps left/right with `holdFrames ∈ {2, 4, 8, 12, 16, 20,
       24, 28, 32, 36, 40, 42}`. Filtered by `maxDcForDr` for the
       max possible reach (= release-at-42).
     - Drops left/right off any ledge into the first grounded
       cell below.
     - `wait{frames}` not enumerated by default — the planner
       inserts it only as a recovery action (e.g. after a drop,
       wait for the player to settle).
   - `actionToRecording(action, frameStart)` emits
     ScriptedInput-compatible events:
     - `walk`: hold dir at frameStart, release at frameStart +
       cells × 5.
     - `jump`: hold dir at frameStart, press space at frameStart,
       release space at frameStart+1, release dir at frameStart +
       holdFrames.
     - `drop`: hold dir at frameStart, release at frameStart +
       fallDuration.
   - `actionToWhy(action, subgoalName)` produces the trace's
     `why:` string. For jumps: "jump dir (release at frame N)
     toward subgoalName".
2. `src/agent/actions.test.js`: ~12 unit cases covering each
   kind + params combination + edge ordering.
3. **No behaviour change** in the editor — nothing imports
   actions.js yet.

Commit: `v21 m1: agent action taxonomy (walk/jump-with-release/drop/wait)`.

## Milestone 2 — Per-action simulator + scene override hook

1. `src/play/playtestScene.js`:
   - New `setPlayerState({x, y, vx, vy, onGround})` method:
     `this.player.x = x; this.player.y = y; this.player.vx = vx;
     this.player.vy = vy; this.player.onGround = onGround;`
   - v9-original glue (PlaytestScene is not vendored upstream); the
     live launcher doesn't call this method, so existing behaviour
     is unchanged.
2. `src/agent/simAction.js`:
   - `simulateAction({parsed, legend, tileset, startState, action})`:
     - Mints a fake game with `ScriptedInput(action.recording)`.
     - Constructs `PlaytestScene`, calls `enter()`, then
       `scene.setPlayerState(startState)` to force the launch
       position + velocity.
     - Loops `scene.update(1/60)` for `action.cost + 8` frames
       (small post-action buffer to settle).
     - Returns `{outcome, endCell, endPos, endVel, collided}`.
3. `src/agent/simAction.test.js`: ~8 unit cases including
   release-frame mathematics (jump_right_release_at_8 lands
   shorter than release_at_42) + sub-pixel start position
   round-trips + collision detection.
4. **No behaviour change** in the editor — simAction is wired
   in M3.

Commit: `v21 m2: per-action simulator + PlaytestScene.setPlayerState`.

## Milestone 3 — Action-graph builder

1. `src/agent/grid.js` rewrite:
   - `buildNavGraph(parsed, legend, tileset)`:
     - Iterates grounded cells (same as v20).
     - For each cell, `enumerateActions(cell, grid)` yields
       candidates.
     - Pre-filter via the v20.1 `maxDcForDr` + simple bounds
       check (saves running simAction on obviously-impossible
       candidates).
     - For each surviving candidate, `simulateAction(...)`. Keep
       only the actions ending on a grounded cell in-bounds with
       no fatal collision.
     - Build edges: `{startCell, action, endCell, endPos, endVel,
       recording, cost, why}`.
   - The v20 `addWalkEdges` / `addDropEdges` / `addJumpEdges`
     functions are replaced by a single
     `addActionEdges(cell, grid, parsed, legend, tileset)`.
2. `src/agent/grid.test.js`:
   - Existing walk/drop/jump assertions reviewed; expected edge
     counts updated to reflect the new model.
   - New cases: each edge has a non-empty `recording`; release-
     frame jump edges land at expected positions; wall-collision
     candidates are filtered out.
3. **Visible after this commit**: nothing imports the new graph
   yet — M4 wires the planner.

Commit: `v21 m3: action-graph builder — edges correct-by-construction via simAction`.

## Milestone 4 — A* over the action-graph + async runner

1. `src/agent/planner.js`:
   - A* node identifier becomes `"r,c|vyBucket"`. Walks +
     grounded landings yield `vyBucket=0`; mid-fall drops or
     overshoots yield `vyBucket=1`. (For v21 we expect only
     `vyBucket=0` since the graph builder only keeps grounded-
     landing edges; the bucket exists to make sub-pixel states
     unique across the planner's open-set.)
   - Trace entries gain `endPos`, `release` (number, undefined
     for non-jumps), and `endVel`. The recording emission walks
     the trace and concatenates each edge's pre-built recording
     (offset by the running frame cursor).
   - `replan` unchanged in structure: marks the failing edge as
     blocked, re-runs `plan`.
2. `src/agent/planner.test.js`:
   - Existing tests reviewed; release-frame-bearing levels added.
   - New case: a level requiring release-at-N picks the right N
     (assert the plan's jump trace entry has the expected
     `release` field).
3. `src/agent/runner.js`:
   - **Becomes `async`**. New signature: `await testLevel(parsed,
     legend, tileset, { maxRuntimeMs = 5000, onProgress, signal })`.
   - Internal yield helper `await new Promise(r => setTimeout(r,
     0))` between chunks (graph-build-per-cell, A*-per-50-nodes,
     replan attempts). `onProgress(elapsedMs, totalMs)` fires at
     each yield.
   - Termination: `(Date.now() - startTime) >= maxRuntimeMs`
     OR `signal?.aborted` (Esc → cancel). `replanBudget` becomes
     a SECONDARY safety cap (default 10) used only to protect
     against runaway loops; primary cap is wall-clock.
   - Goal-ordering search: greedy nearest-first runs first; if
     time remains, tries alternative orderings (random subsets
     for pickup-required = K of N; permutations for K = 'all').
   - `maxFrames` (per-sim) stays at 1200.
4. **Visible after this commit**: `[Test]` on `tutorial.txt`
   should now return a solution within the 5s default. UI is
   not yet wired to show the countdown — that lands in M5.

Commit: `v21 m4: planner A* over action-graph + async runner with time budget`.

## Milestone 5 — UI: countdown timer + escalation + overlay arcs

1. `src/agentDialog.js`:
   - New `openAgentDialog({ runAgent, initialBudgetMs, ... })`
     shape — opens immediately in **searching** state with a
     countdown display (`<output class="countdown">5.0s</output>`)
     + a `<progress class="countdown-bar">` element.
   - The `runAgent(maxRuntimeMs, onProgress)` callback (passed
     in from `main.js`) is awaited; while it runs, `onProgress
     (elapsedMs, totalMs)` updates the countdown.
   - On resolve, dialog transitions to **success** or **failure**
     state.
   - Failure state renders three escalation buttons:
     ```
     ✗ No solution found within 5s.
     The agent ran out of replan attempts.
     Last simulation: timeout at frame 1200…
                              [Try 10s] [Try 15s] [Try 20s] [Close]
     ```
     Each `[Try Ns]` re-invokes `runAgent(N*1000)`, transitions
     back to searching state, repeats.
   - Esc / backdrop close → aborts via `AbortController`
     (passed into runAgent's `signal`).
2. `src/main.js`:
   - `#testBtn` click handler rewritten: opens the dialog in
     searching state immediately; `runAgent` wrapper calls
     `testLevel(parsed, legend, tileset, { maxRuntimeMs,
     onProgress, signal })`. On success, paints overlay +
     transitions dialog. On failure, dialog renders escalation.
3. `src/agent/overlay.js`:
   - `renderSolutionOverlay` polyline construction extended: for
     `jump` trace entries, interpolate 6 intermediate
     `{xPx, yPx}` samples along the parabola between `startPos`
     and `endPos` so the rendered arc curves naturally instead
     of being a single straight line between cell centers.
   - Walk + drop edges still use endpoint pairs (linear).
   - Numbered markers unchanged.
4. `src/style.css`:
   - `.agent-dialog .countdown` — large monospace timer.
   - `.agent-dialog .countdown-bar` — `<progress>` styling.
   - `.agent-dialog .escalation-row` — three buttons in a row.
5. **Visible after this commit**: clicking `[Test]` immediately
   shows a live 5-second countdown; on failure, three "Try N
   seconds" buttons appear; canvas overlay shows curved jump arcs.

Commit: `v21 m5: UI — countdown timer + escalation flow + curved arc overlay`.

## Milestone 6 — e2e + transcript + Delivered

1. `tests/agent-test-button.spec.js`:
   - Existing 4 cases unchanged.
   - New case: load `tutorial.txt`, click `[Test]`, assert
     success badge + non-empty trace + at least one `jump`
     entry with release-frame info in its `why:` text.
   - New case: load `above_ground.txt`, same.
   - New case: load the tower-cherry level (24×14 with `o` on
     a 3-wide tower), assert success + cherry-collected stats
     pill + reach-exit confirmation.
   - New case: Demo replay on the tower level reaches
     `phase=won` (body.demomode set → cleared within 6s).
2. `TDDs/3_transcripts/version21_build.md`: narrative; the
   architectural calls (edges-by-physics-simulation, release-
   frame action vocabulary, sub-cell endPos continuity); the
   M1–M6 commit-hash table; v22+ candidates carried forward
   (multi-solution enumeration, TSP-optimal ordering,
   author-difficulty rating, etc.).
3. Mark design + impl Delivered with the M1–M6 commit-hash
   table.

Commit: `v21 m6: agent e2e (tutorial+above_ground+tower solve) + transcript; Delivered`.

## Risks & sequencing

- **M1 is pure + standalone.** Action taxonomy lives in its
  own module; no consumers yet. Low risk.
- **M2 has the engine touch point.** `PlaytestScene.set
  PlayerState` is the only non-pure change. v9 §7 is preserved
  because PlaytestScene is v9-original-glue, not vendored
  upstream. The live launcher doesn't call setPlayerState, so
  existing playtest + demo behaviour is byte-unchanged.
- **M3 is the architectural pivot.** Risk: graph build cost.
  For each grounded cell × ~30 candidates × ~50µs/sim ≈ 50ms
  on a small level; ~1s on a 700-cell level. Mitigation: cache
  results, prefilter with `maxDcForDr` to skip obviously-
  impossible candidates, parallelize via `Promise.all` if
  perceived slow.
- **M4 is where the regressions could land.** Risk: the
  trace's shape change breaks the dialog rendering or the
  overlay's path drawing. Mitigation: M5 updates both to the
  new fields; if M5 lands before M4 is wired (test order),
  the dialog falls back to its existing renderer which is
  shape-tolerant.
- **M5 is visible polish.** Risk: parabola interpolation
  glitches at edge cases (e.g. very-short-hold jumps). The
  interpolation samples follow the same physics math as the
  graph builder, so consistency is guaranteed.
- **M6 is docs + e2e.** Risk: the new Playwright cases time
  out if graph build is slow. Mitigation: each test loads a
  specific level and waits for the dialog (no hard frame
  deadline beyond the 5s default).
- **No deploy risk.** Bundle grows by ~5–7KB (actions.js +
  simAction.js + edge metadata). Pages workflow unchanged.

## Deferred (design §9 → v22+)

- **Multi-solution enumeration** — locked v22 acceptance
  criterion. The action-graph foundation makes Yen's K-shortest-
  paths a drop-in.
- **TSP-optimal pickup ordering** — pair with multi-solution.
- **Learning physics empirically** — probe the engine for jump
  arcs at startup instead of reading `constants.js`.
- **Backtracking around walls** (collect-key-then-return) —
  needs a richer goal model.
- **Author-difficulty rating** — composite from `{steps, jumps,
  releases, replans, deaths}`.
- **Web Worker for big-world graph build** — only if perceived
  performance demands it.
- **Multi-level cross-agent** — pairs with v22+ doors / tunnels
  feature.

Plus the long-standing v16/v17/v18/v19/v20 carry-overs:
- Damped/look-ahead camera, parallax backgrounds.
- Decoration-image free placement.
- Layered z-order with named layers.
- Per-cell animation phase offset, pause-aware animation.
- Multi-row tile atlases, state-changing exit.
- v17 dead-end `caretLineCol` cleanup.
