# Version 25 — Implementation Plan

Status: **Delivered (2026-05-23)** · Design:
[../1_design/version25_design.md](../1_design/version25_design.md)
· Transcript:
[../3_transcripts/version25_build.md](../3_transcripts/version25_build.md)

Six small path-scoped commits. The agent thread (M1–M4) landed first
to close the v24 architectural carry-over; the polish thread (M5)
fit alongside without conflict; M6 closed with acceptance +
transcript.

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `796a9c9` | endState on edges |
| 2 | `8dba253` | planner re-simulation |
| 3 | `68d3894` | below_ground progress + regression gate |
| 4 | `9cdbc0f` | precision_landing edge rule |
| 5 | `8d70cb3` | AudioContext pre-warm |
| 6 | _this commit_ | acceptance + transcript + Delivered |

Tests at delivery: 295 unit / 76 Playwright. v9 §7 invariant preserved.

**Architectural route**: design §3.1.a (sub-pixel-aware endpoints
+ re-simulate in planner). The cell-resolved graph stays for SEARCH;
sub-pixel re-simulation handles RECORDING emission. 3.1.b (per-frame
planner) carries to v26+ — needed for the full `below_ground.txt`
solve since A* doesn't yet search over sub-pixel state space.

## Process (same discipline as v8–v24)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/` / tileset `src.txt` / `sources.txt`
  files stay out.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v25 only touches
  `src/agent/*` and the v9-original glue (`playtestScene.js` or
  `assets.js` for M5).

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - `simulateActionInContext` return shape extends ADDITIVELY:
    `endState` and (optional) `trajectory` are new fields. The
    existing `endCell` / `endPos` / `endVel` / `collided` / `cost`
    stay. v21–v24 callers reading the old fields continue to work.
  - The cell-resolved graph (`nodes` + `edges` Maps in
    `buildNavGraph`) is unchanged for A* search; only the edge
    OBJECTS gain a new field.
  - The planner's `emitLegInputs` adds re-simulation INSIDE the
    function (between picking the edge and emitting events). The
    plan return shape stays the same.
  - Levels that already solve must continue to solve (full agent-
    suite Playwright pass before each commit).
- **Riskiest change**: M2 (re-simulate in planner). It changes the
  trajectory of every plan, not just below_ground's. Mitigation:
  run the full agent suite at each milestone gate; if a level
  regresses, the build-time edge model is the place to look (the
  cell that used to be reachable via a forgiving overshoot may
  no longer be — fix by adding the CORRECT edge instead, e.g. via
  precision_landing in M4).
- **Trajectory memory cap**: M4 collects per-frame trajectory only
  when at least one precision-landing-needed target exists in the
  level. Levels without 1-tile pickups stay byte-identical.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/agent/simAction.js` | `simulateActionInContext` and `simulateAction` return `endState: {x, y, vx, vy, onGround}` alongside the existing fields. The data is already available inside `runSimLoop` — just expose it | M1 |
| `src/agent/grid.js` | `addActionEdges` stores `endState` on each edge object. Existing edge fields unchanged | M1 |
| `src/agent/grid.test.js` (or new test) | Asserts edges carry `endState` matching the build-time sim | M1 |
| `tests/v25-edge-state.spec.js` (new) | Playwright: load a level, inspect `buildNavGraph`'s edges, assert `endState` shape | M1 |
| `src/agent/planner.js` | Inside `emitLegInputs`, before processing each step's edge, **re-simulate the action from the previous step's `endState`**. Use the re-simulated landing position as the input for the next step's edge selection. The build-time `to`-cell remains the GOAL the A* picked, but the actual recording uses the re-sim trajectory | M2 |
| `tests/v25-resim.spec.js` (new) | Playwright: construct a 2-step plan; assert re-simulation produces a recording that lands the player at the build-time-predicted end cell with sub-pixel precision | M2 |
| `tests/v25-below-ground-solves.spec.js` (new) | Acceptance: `below_ground.txt` solves within 5s. Replaces `tests/v24-below-ground.spec.js`'s carry-over assertion | M3 |
| `tests/agent-test-button.spec.js` (regression) | All v21+v22+v23+v24 cases still pass — no other shipped level regresses | M3 |
| `src/agent/simAction.js` | Optional `opts.collectTrajectory` flag; when set, `runSimLoop` accumulates per-frame `{x, y}` into a `trajectory` array; returned alongside the existing fields | M4 |
| `src/agent/grid.js` | When `precisionTargets` (pickup cells + exit cells with 1-tile-wide neighbourhoods) is non-empty, pass `collectTrajectory: true` to the sim. For each candidate action, check ±2 px target-centre passes; emit an additional edge to that target's cell | M4 |
| `tests/v25-precision-landing.spec.js` (new) | Constructed level with a 1-tile pickup midway in a fall arc; agent reaches it | M4 |
| `src/play/playtestScene.js` (or `src/play/assets.js`) | Pickup-touch sound timing fix per the §3.4 investigation. Three-step escalation: call-order → AudioContext.resume → AudioBufferSourceNode | M5 |
| `tests/v25-pickup-sound.spec.js` (new) | Asserts the collect sound fires within N ms of the pickup-collision frame (instrument with `performance.now()` from a test hook) | M5 |
| `TDDs/3_transcripts/version25_build.md` (new) | narrative covering each milestone | M6 |

## Milestone 1 — Sub-pixel endState on edges

1. `src/agent/simAction.js`:
   - In `finalise(scene, cost, outcome, collided)`, expose
     player's full state:
     ```js
     return {
       outcome,
       endPos: { x: px, y: py },
       endCell: { r: Math.floor(cy / TILE), c: Math.floor(cx / TILE) },
       endVel: { vx: scene.player.vx, vy: scene.player.vy },
       // v25 M1: full physics state for sub-pixel-aware edge
       // model. setPlayerState consumes the same shape.
       endState: {
         x: scene.player.x,
         y: scene.player.y,
         vx: scene.player.vx,
         vy: scene.player.vy,
         onGround: scene.player.onGround,
       },
       collided,
       cost,
     };
     ```
2. `src/agent/grid.js`:
   - In `addActionEdges`, store `endState` on the edge:
     ```js
     edgesArr.push({
       to: cellKey(targetR, targetC),
       kind: action.kind,
       cost: result.cost,
       dir: action.params.dir,
       action,
       recording: actionToRecording(action, 0),
       endPos: result.endPos,
       endVel: result.endVel,
       endState: result.endState, // v25 M1
       isWinEdge,
     });
     ```
3. `tests/v25-edge-state.spec.js`:
   - Load simple.txt; build the nav graph.
   - Assert at least one edge has `endState` with the five fields.
   - Assert `endState.x / endState.y` match `endPos.x / endPos.y`
     (back-compat — same data, new field).
4. **Visible after this commit**: no user-visible change. Edges
   carry richer state; planner doesn't use it yet.

Commit: `v25 m1: edges carry sub-pixel endState alongside endCell`.

## Milestone 2 — Re-simulate in planner

1. `src/agent/planner.js`:
   - In `emitLegInputs` (or wherever the per-step recording is
     assembled), before processing the current step:
     - Read `prevEndState` from the previous step's edge (or
       initial state for the first step).
     - Re-run the current step's action via
       `simulateActionInContext(ctx, prevEndState, edge.action)`.
     - Use the re-simulated result's `endState` as `prevEndState`
       for the NEXT step.
     - Concatenate the action's recording with the planner's
       accumulating recording, offset by the current frame
       counter (existing logic).
   - The build-time `edge.cost` is the CANDIDATE cost; the
     re-simulated cost is the actual frame-count to advance by.
2. `tests/v25-resim.spec.js`:
   - Construct a 2-step plan: walk-right + jump-right.
   - Assert that the recording's emit replays through the whole-
     plan sim and lands the player at the SAME position the
     build-time edge predicted (within ±1 px).
3. **Visible after this commit**: the agent's plan is now
   ground-truth aligned with physics. Levels that solved via
   forgiving overshoots may need either NEW edges (added in M4
   via precision_landing) or accept that some plans regress
   temporarily.

Commit: `v25 m2: planner re-simulates each step from prev endState`.

## Milestone 3 — below_ground.txt solves + regression check

1. `tests/v25-below-ground-solves.spec.js`:
   - Load `below_ground.txt`; click Test; expect `.badge.ok`
     within 5 s.
   - Replaces the `tests/v24-below-ground.spec.js`'s carry-over
     assertion.
2. Full agent-suite Playwright pass (full v21-v24 specs):
   - `tests/agent-test-button.spec.js` (all v21 cases)
   - `tests/v22-acceptance.spec.js`
   - `tests/v23-action-graph.spec.js`
   - `tests/v24-*.spec.js`
   - All must continue to pass.
3. Delete `tests/v24-below-ground.spec.js` (its assertions are
   now in `v25-below-ground-solves.spec.js`).
4. **Visible after this commit**: `below_ground.txt` now solves
   in the editor's Test flow.

Commit: `v25 m3: below_ground.txt solves under the sub-pixel edge model`.

## Milestone 4 — precision_landing edge rule

1. `src/agent/simAction.js`:
   - Add `opts.collectTrajectory` flag to `simulateActionInContext`
     and `simulateAction`. When set, `runSimLoop` pushes
     `{x, y}` per frame to a `trajectory: []` array; returned
     alongside the existing fields.
   - When unset (the back-compat path), no trajectory work.
2. `src/agent/grid.js`:
   - Compute `precisionTargets = new Set([...pickupCells,
     ...exitCells])`. Pass `collectTrajectory: true` to the sim
     when `precisionTargets.size > 0` AND at least one target is
     a "1-tile" target (no adjacent walkable cell on either
     side, so the cell-resolved edge model can't reliably catch
     it via flooded edges).
   - For each candidate action's trajectory, check ±2 px target-
     centre passes with vy > 0 (descending). Emit an additional
     edge to that target's cell.
3. `tests/v25-precision-landing.spec.js`:
   - Construct a level: 1-tile pickup wedged between two walls
     at the bottom of a fall arc. Build nav graph; assert pickup
     cell has at least one incoming edge.
   - Drive Test; assert agent solves the level.
4. **Visible after this commit**: 1-tile pickups become
   reachable. No regression on existing levels (precision_landing
   only adds edges; doesn't remove any).

Commit: `v25 m4: precision_landing edge rule for 1-tile targets`.

## Milestone 5 — Pickup-touch sound timing fix

1. Investigate first — add a `performance.now()` instrument in
   `PlaytestScene.update`'s pickup branch + the `assets.play`
   callsite. Run the existing agent-Demo Playwright test;
   capture the lag.
2. Fix per the design's escalation:
   - **2.a**: move `assets.play('coin')` call BEFORE the
     score++/visual-update if it's currently after.
   - **2.b**: on Play / Test click, call
     `audioContext.resume()` so the first sound doesn't pay the
     resume latency. (Web-Audio context.resume is no-op if
     already running.)
   - **2.c**: if 2.a + 2.b don't close the gap, swap from
     `<audio>.play()` to a pre-decoded `AudioBufferSourceNode`
     for the coin sound.
3. `tests/v25-pickup-sound.spec.js`:
   - Run a known-recording demo; capture the
     pickup-collision frame's `performance.now()` and the
     audio-play frame's `performance.now()`.
   - Assert the delta is < 50 ms (or whatever threshold the
     measurement shows is achievable).
4. **Visible after this commit**: pickup collect feels snappier.

Commit: `v25 m5: pickup-touch sound timing fix`.

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `tests/v25-acceptance.spec.js` (optional cross-cutting case):
   - e.g. "themed editor + light mode + below_ground solves" —
     a single test that exercises the v22-v25 stack end-to-end.
2. `TDDs/3_transcripts/version25_build.md`: narrative covering
   the architectural fix (cell-resolved → sub-pixel endpoints),
   the planner re-simulation, the below_ground unlock, the
   precision_landing rule, and the sound timing fix.
3. Mark design + impl Delivered with the M1–M6 commit-hash table
   (matching v22/v23/v24 pattern).

Commit: `v25 m6: acceptance + v25 transcript; design + impl Delivered`.

## Risks & sequencing

- **M2 regression risk** — re-simulation changes EVERY level's
  trajectory. Mitigation: full agent-suite at M3 gate. If a
  level fails: investigate whether the build-time edge model
  is missing a needed edge (precision_landing in M4 may fix it),
  or whether the level genuinely depends on the old buggy
  behaviour (rare; document for v26).
- **M4 trajectory memory** — guarded by `precisionTargets.size > 0`.
  For typical levels with multi-cell pickups, no overhead.
- **M5 sound timing might be browser-bound** — the lag could be
  intrinsic to the Web Audio engine. Mitigation: instrument
  first; if no fix closes the gap, document the finding and
  leave the user's expectation calibrated.
- **No deploy risk** — bundle grows by ~2-4 KB total across M1-M5.

## Deferred (design §9 → v26+)

- **3.1.b — per-frame-trajectory planner** (fallback if 3.1.a
  doesn't close all gaps).
- **Double-jump engine extension** (would break v9 §7
  invariant).
- **Reactive theme listener** (OS-pref mid-session flips).
- **Viewport guide follows mouse**.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence**.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles**.
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.

Plus the long-standing v16/v17/v18/v19 carry-overs.
