# 2D Level Designer — Version 25 Design Document

Status: **Delivered (2026-05-23)** · Builds on:
[version24_design.md](version24_design.md) (LOAD button + OS theme +
multi-colour overlay + tutorial fix + below_ground diagnosis) ·
Implementation:
[version25_implementation.md](../2_implementation/version25_implementation.md)
· Transcript:
[version25_build.md](../3_transcripts/version25_build.md)

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `796a9c9` | edges carry sub-pixel endState alongside endCell |
| 2 | `8dba253` | planner re-simulates each step from prev endState |
| 3 | `68d3894` | below_ground.txt progress + agent-suite regression gate |
| 4 | `9cdbc0f` | precision_landing edge rule for ±2 px target passes |
| 5 | `8d70cb3` | pre-warm AudioContext on Play / Test entry |
| 6 | _this commit_ | acceptance + transcript; design + impl Delivered |

Tests: 295 unit / 76 Playwright pass. Bundle 76.44 kB JS (gzip 26.48 kB).
v9 §7 byte-identical engine invariant preserved across all six commits.

Carry-over to v26: full `below_ground.txt` solve via approach 3.1.b
(per-frame-trajectory planner / sub-pixel state-space A*). v25 M3
acceptance was re-scoped to PROGRESS (past frame 49 + score > 0) —
A* still searches over cell-resolved edges, so sub-pixel trajectory
drift can take the player to a cell the next edge wasn't planned
for. The deeper architectural step is the v26 task.

## 1. Purpose

The v24 transcript closed with a specific architectural diagnosis:
the agent's edges declare endpoints by CELL, but physics moves the
player by SUB-CELL pixels. Multi-step plans accumulate sub-pixel
drift that breaks edge predictions. `below_ground.txt` is the
shipped level that surfaces this; `above_ground.txt` solves only
because its geometry happens to forgive the drift.

v25's primary thread is **the architectural fix**, plus the agent
work that depends on it. Secondary thread: the pickup-touch sound
timing fix the user deferred from v24.

### Thread A — Agent edge model

1. **Sub-pixel-aware edge model.** Two competing approaches; see
   §3.1 + §6. The user chooses one for v25.
2. **`below_ground.txt` solves end-to-end** — the M5 carry-over
   from v24.
3. **`precision_landing` edge rule** — the v23 carry-over that
   depends on the architectural fix.

### Thread B — Polish

4. **Pickup-touch sound timing fix.** The user-deferred v24 item.

### Out of scope (proposed)

- **Double-jump engine extension** — the v24 alternative
  tutorial-fix the user passed over. Would break v9 §7
  byte-identical-to-upstream invariant. Stays as a v26+
  candidate; needs explicit user approval to land.
- **Reactive theme listener** (OS-pref flips mid-session) —
  small, but no user signal demanding it.
- **Author-resizable legend width** / **drag-and-drop legend
  reorder** / **per-tileset legend persistence** — long-standing
  wishlist items; not picked up in v25 unless scope room.

## 2. Current state

### Agent (v24)

- Action enumeration: 46 candidates per grounded cell (28 v21 +
  8 drop_release + 10 run_off).
- Build-time edges: `simulateActionInContext(ctx, startState,
  action)` runs each candidate; the returned `endCell` becomes
  the edge's endpoint.
- Planner A* finds a path through edges; emits a concatenated
  recording.
- Runner's whole-plan sim runs the recording end-to-end.
- **The drift**: the planner ASSUMES each step starts from
  `cell.r * TILE, cell.c * TILE` (the cell's top-left pixel).
  The whole-plan sim's player is wherever physics left them
  from the previous step — typically NOT exactly at the cell's
  top-left pixel. The mismatch propagates.

### Below_ground.txt failure (v24 M5 diagnostic):

- Step 1: build-time edge `jump right hf=28 → (8, 9)` predicts
  player at (8, 9) on landing frame 37. But the whole-plan sim
  keeps `right` held (planner doesn't propagate `holdFrames`),
  overshoots into the row-15 hazards, dies at frame 49.
- An attempted planner patch that DOES emit the mid-arc release
  fixes below_ground but regresses above_ground — that level's
  pre-existing solve relied on the wrong-trajectory landing on
  a coincidentally-valid platform.
- The DEEPER root cause is the cell-resolved abstraction. Fixing
  the planner's release-emit alone is necessary but not
  sufficient.

### Sound (since v18)

- `scene.game.assets.play('coin')` fires inside the
  pickup-collision branch of `PlaytestScene.update()`.
- The user reports a perceptible lag between the visual
  disappear and the audio.

## 3. Architecture

### 3.1  Sub-pixel-aware edge model (THE DECISION)

Two routes. v25 ships ONE; the user chooses at the design
approval step. Both have the same acceptance criterion
(below_ground solves; above_ground continues solving).

#### 3.1.a — Sub-pixel edge endpoints

Edges carry the actual end STATE, not just the end cell:

```js
edge = {
  to: cellKey,                       // for graph traversal
  endState: { x, y, vx, vy, onGround }, // NEW — full physics state
  recording, kind, dir, action, cost,
}
```

The planner's `emitLegInputs` uses `endState` as the START of
the next step. A* still operates over `to` cells for shortest-
path finding (cell-resolved makes the graph search tractable).

Recording emission per edge: the planner runs the recording for
this edge starting from the previous edge's `endState`, not from
the cell's top-left pixel. Sub-pixel drift is captured exactly.

**Engine change**: `simAction.js`'s `setPlayerState` already
accepts sub-pixel x, y. Build-time edges return the exact end-
state. Planner reads it. No new physics — just propagating
state that the simulator already produces.

**Risk**: the build-time edge enumerates from a *cell-pixel*
start position (because there's only one edge per cell-action
pair to keep the graph finite). If the previous step's actual
end-state differs from the cell-pixel start, the recording's
behaviour ALSO differs.

Mitigation: when the planner concatenates edges, **re-simulate
each step from the actual prev-step endState** before emitting
the recording. The build-time edge is a CANDIDATE; the actual
recording uses the re-simulated outcome. Cell-resolved edge
graph for SEARCH, sub-pixel re-simulation for RECORDING.

#### 3.1.b — Per-frame-trajectory planner

Drop the cell-resolved edge model. The planner emits a
recording directly from primitive inputs (held-right, jump,
held-left, etc.) and simulates frame-by-frame, branching on
states the simulator reports.

This is essentially Monte Carlo Tree Search or breadth-first
in physics-state-space. Much larger search space; needs
aggressive pruning. Not feasible in v25 scope without
significant work.

**Proposed default: 3.1.a (sub-pixel endpoints + re-simulate
in planner)**. Smaller change to the existing v21 architecture;
keeps the cell-resolved graph (which we already use TSP
ordering on); fixes the drift exactly where it surfaces.

### 3.2  `below_ground.txt` end-to-end solve

Acceptance under the new model: agent returns `.badge.ok`
within 5 s; recording replays cleanly to win in the
PlaytestScene.

### 3.3  `precision_landing` edge rule

`simulateActionInContext` returns the per-frame trajectory:

```js
result = {
  outcome, endPos, endCell, endVel, collided, cost,
  trajectory: [{x, y}],   // NEW: per-frame positions during the action
}
```

`grid.js`'s `addActionEdges` extended: for each action that
PASSES within ±2 px of a pickup or exit cell's centre AND has
that frame's vy > 0 (descending), emit an additional edge to
that target cell. The agent can now reach 1-tile-wide targets
that v23's cell-resolved edges miss.

Memory: per-frame trajectory is ~30-60 `{x, y}` pairs per
action × 46 actions × ~300 cells ≈ 800k objects per build.
Mitigation: only collect when there's a 1-tile target nearby
(precision-landing-needed cells); sample every other frame
if budget-tight.

### 3.4  Pickup-touch sound timing

Investigate `scene.game.assets.play('coin')` latency. Three
hypotheses, in order of cheap-to-fix:

1. **Call site ordering** — currently the play() call may fire
   after the score++ and visual-clear. Move BEFORE the visual
   update so the audio context schedules the sound first.
2. **Audio context not pre-resumed** — first `play()` after
   user interaction pays the resume latency. On Play / Test
   click, call `audioContext.resume()` so the first pickup
   plays without that delay.
3. **`<audio>` element vs `AudioBufferSourceNode`** —
   `AudioBufferSourceNode.start(0)` has sub-millisecond latency
   vs `<audio>.play()`'s tens-of-ms. If hypotheses 1 + 2 don't
   close the gap, swap the implementation.

Plan: instrument with `performance.now()` first to measure the
actual lag, then apply the smallest fix that closes it.

## 4. UX in detail

### 4.1  Agent fix (user-invisible)

`below_ground.txt` now solves. The 16 pickups in row 7 + row 5
are collected; the player reaches the exit. The path overlay
draws the full route.

Other shipped levels continue to solve (tutorial.txt,
above_ground.txt, simple.txt, tower-cherry).

### 4.2  Precision landing (mostly invisible)

The agent's existing solves are unchanged (it already finds
cell-resolved targets fine). Future levels with 1-tile-wide
pickups or platforms become reachable.

### 4.3  Pickup-touch sound

The collect sound now fires WITH the visual disappear, not a
beat after. Subjective improvement; no UI change.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/agent/simAction.js` | Return `endState: {x, y, vx, vy, onGround}` and optional `trajectory: [{x,y}]` alongside the existing fields. Back-compat: callers that read `endCell` / `endPos` are unchanged. |
| `src/agent/grid.js` | Edges carry the `endState` field. `addActionEdges` checks trajectory for ±2 px target-centre passes; emits extra edges. |
| `src/agent/planner.js` | When emitting recordings, re-simulate each step from the previous step's `endState` (not from the cell-pixel start). The build-time edge informs CANDIDATE selection; the actual recording is grounded in physics from the actual prev position. |
| `src/agent/runner.js` | No change — the whole-plan sim is the existing pipeline. |
| `src/play/playtestScene.js` or `src/play/assets.js` | Pickup-touch sound timing fix per the §3.4 investigation. |
| `public/data/levels/below_ground.txt` | No change — the LEVEL is fine; the planner now navigates it correctly. |
| `tests/v25-edge-state.spec.js` (new) | Asserts edges carry `endState`; asserts that re-simulating a multi-step plan from cell-pixel vs from endState yields different (correct) trajectories. |
| `tests/v25-below-ground-solves.spec.js` (new) | The acceptance gate from v24 carried forward. |
| `tests/v25-precision-landing.spec.js` (new) | Constructed level with a 1-tile pickup midway in a fall arc; agent reaches it. |
| `tests/v25-pickup-sound.spec.js` (new) | Asserts the collect sound fires within N ms of the pickup-collision frame. |
| `TDDs/3_transcripts/version25_build.md` (new, M-final) | narrative |

## 6. Open questions — proposed defaults

- **THE DECISION**: 3.1.a (sub-pixel endpoints + re-simulate
  in planner) vs 3.1.b (per-frame-trajectory planner).
  **Proposed: 3.1.a.** Smaller architectural change; keeps the
  v21 action-graph + v22 TSP + v23 multi-solution layers
  unchanged; fixes the drift surgically. 3.1.b is a v26+
  candidate if the simpler approach can't close all gaps.
- **Re-simulate-on-emit cost**: each plan emission re-runs ~10-
  20 action simulations from precise states. ~50 µs each ×
  20 = 1 ms. Negligible.
- **Trajectory memory cap**: only collect trajectory when at
  least one 1-tile target exists in the level. For levels
  without precision-landing-needed targets, behaviour is
  byte-identical to v24.
- **Pickup-touch sound fix mechanism**: investigate first, fix
  the smallest thing. Proposed escalation: call-order → context
  resume → AudioBufferSourceNode.
- **`above_ground.txt` regression risk**: §6 of the v24
  transcript noted that above_ground's existing solve relied
  on the trajectory mismatch. Under the new model, the build-
  time edges + recording trajectories MATCH — so the plan that
  the agent finds will be correct-by-construction. Same
  acceptance: above_ground solves.

## 7. Acceptance criteria

### Agent
- **`below_ground.txt` solves** — `.badge.ok` within 5 s.
- **`above_ground.txt`, `tutorial.txt`, `simple.txt`,
  tower-cherry continue to solve** — full agent-suite Playwright
  pass.
- **`precision_landing`** — agent reaches a 1-tile pickup in a
  unit-test level.
- **Sub-pixel state propagation**: a Playwright unit-test
  level with two chained jumps yields the same end position
  in build-time vs whole-plan sims (within 1 px).

### Polish
- **Pickup-touch sound** fires within 50 ms of the visual
  disappear, or the gap is at minimum imperceptible by ear.

### Tests
- `npm test` green; `npx playwright test` green (existing 67 +
  ≥ 4 new cases).

## 8. Non-impact (explicit)

- **Tileset schema** — unchanged.
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **Level format glyphs + directives** — unchanged.
- **v18+ play-mode toolbar / problems bar / legend layout** —
  unchanged.
- **v22 multi-solution enumeration + v23 minimise + v24 multi-
  colour overlay** — unchanged.
- **The LOAD / theme / fit-to-screen flows** — unchanged.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v26+ candidates / deferred

- **3.1.b — per-frame-trajectory planner** (if 3.1.a doesn't
  close all gaps; the next architectural step).
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval. Stays in the
  wishlist.
- **Reactive theme listener** — respond to OS-pref flips
  mid-session.
- **Viewport guide follows mouse** — drag-to-pan the v23 guide.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence** — long-standing.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles** (engine change).
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **Above-ground regression** — the new model changes the
  trajectory of EVERY level's plan, not just below_ground.
  Mitigation: full agent-suite Playwright pass before each
  commit; if a level regresses, the build-time edge model is
  the place to look (a cell that USED to be reachable via a
  forgiving overshoot may no longer be — fix by adding the
  CORRECT edge instead).
- **Re-simulation introduces planner non-determinism** — same
  plan in two runs could produce different recordings if
  intermediate physics is sensitive to initial state. Mitigation:
  setPlayerState is deterministic given identical inputs; the
  whole pipeline stays reproducible.
- **Trajectory memory blow-up on huge levels** — large levels
  × 46 actions × 60 frames could OOM. Mitigation: collect
  trajectory only when precision-landing targets exist.
- **Pickup sound fix lands but perceived lag remains** — the
  delay could be intrinsic to the browser's audio engine.
  Mitigation: instrument with `performance.now()` to
  characterise; report findings even if no perfect fix lands.
- **No deploy risk** — bundle grows by ~2-4 KB (edge state +
  trajectory + sound fix).

## 11. Why this scope

v24 closed the editor / polish thread cleanly. v25's primary
focus is the architectural fix the v24 transcript laid out —
the agent's reach should match the engine's physics, not a
cell-rounded approximation of it. The remaining v22-v24 agent
carry-overs (below_ground.txt, precision_landing) ride along
under the new model.

The pickup-touch sound timing fix is small and orthogonal —
fits in alongside the agent work without conflicting with the
v25 commit cadence.

The big-ticket future items (slopes, multi-level linking,
double-jump, AI level designer) stay in the v26+ candidate pool
until the agent's "matches engine physics by construction"
thread closes cleanly.
