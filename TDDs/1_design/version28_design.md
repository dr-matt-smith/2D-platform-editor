# 2D Level Designer — Version 28 Design Document

Status: **Delivered (2026-05-24) — below_ground.txt solves
end-to-end; v25→v26→v27 carry-over retired.** · Date: 2026-05-24 ·
Builds on: [version27_design.md](version27_design.md) · Implementation:
[../2_implementation/version28_implementation.md](../2_implementation/version28_implementation.md)
· Transcript:
[../3_transcripts/version28_build.md](../3_transcripts/version28_build.md).

## 1. Purpose

Single thread: **per-frame trajectory planner**. The architectural
step v27's "Lessons for v28" called out.

v22→v27 built progressively richer bucket discretisations on top of
a cell-resolved nav-graph:

- v22-v24: cell-resolved A* over (r, c) nodes with discrete action
  edges; recording = action sequence.
- v25: sub-pixel `endState` carried per edge; planner re-simulates
  each leg from `prevEndState` to correct cost drift.
- v26: state-space A* over (cell, vxBucket) nodes — 3 vxBuckets per
  cell, partial below_ground progress (score 8 of 16).
- v27: 9-node identity (cell, vxBucket, xOffsetBucket) data model
  shipped (M4); enabling non-L sources in M5 broke the chain;
  shipped conservatively as L-only emission. below_ground.txt
  stayed at v26 baseline.

**v27 finding** (transcript §"Lessons for v28"):
> Bucket-aware A* is fundamentally limited because finer buckets
> make the chain MORE fragile, not less. Each bucket has a single
> representative start state; the live engine's continuous physics
> lands within the bucket but not AT the representative. An action
> sequence optimal for the representative may not work for the
> slightly-off live state. Cumulative drift across a multi-step
> chain breaks the recording.

v28 removes bucketing entirely. A* runs over (cell, frame) nodes;
each edge integrates physics frame-by-frame from the exact
prev-leg endState; no synthetic start states; no bucket boundaries
to drift across.

### Out of scope (proposed deferrals)

- **Top messages row enhancements** (interactive HUD widgets,
  score-history graphs, etc.) — v27 shipped the band; further
  features wait on user signal.
- **Double-jump engine extension** — still needs explicit user
  approval to break v9 §7 byte-identical invariant.
- **Reactive theme listener**, **viewport guide follows mouse**,
  **author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence** — small UX
  items; queued.
- **Minimap with fog-of-war**, **edit-mode level resize**,
  **linked levels via doors / tunnels**, **sloping tiles**,
  **multi-exit / 1-way platform**, **Lemmings-AI adversarial
  mode**, **path-hint tutorial mode**, **AI-rated difficulty**,
  **AI level designer** — bigger features; each warrants its own
  version focus.

## 2. Current state

### Agent (v27)

- Action enumeration: 46 candidates per grounded cell.
- Edges carry sub-pixel `endState` (v25 M1).
- Planner re-simulates each step from `prevEndState` (v25 M2);
  per-leg replan infrastructure landed in v27 M5 (no-op under
  L-only emission).
- `precision_landing` rule emits extra edges for ±2 px target
  passes (v25 M4).
- Node identity = `stateKey(r, c, vxBucket, xOffsetBucket)` with
  `vxBucket ∈ {-1, 0, +1}` and `xOffsetBucket ∈ {'L', 'C', 'R'}`
  (v27 M4); only `xOffsetBucket='L'` sources emit edges; every
  `to` pinned to `xOffsetBucket='L'`.
- **below_ground.txt**: still score 12 of 16; stalls at (5, 29) →
  timeout at frame 2400 (same shape as v26's partial).

### Where v27 ran out

v27's diagnosis pinpointed bucket-vs-physics misalignment as the
limit. The 9-bucket data model is in place; what's missing is a
planner that doesn't pre-commit to a bucket-aligned start.

## 3. Architecture

### 3.1  Per-frame trajectory planner — overview

Replace the cell-resolved action-edge graph with a continuous-state
A* whose nodes are (cell-key, frame-mod-some-period) and whose
edges are produced ON THE FLY by simulating short physics windows
from the live state. No upfront `buildNavGraph` over a bucketed
state space; nodes + edges materialise as A* expands them.

```text
A* node:  { cellKey, exactState }
A* edge:  result of simulating an action window from exactState
                                   ↓
                            generates a sequence of
                            input-recording events
                            + a new exactState
```

`exactState` is the full continuous-physics state:
`{x, y, vx, vy, onGround}`. Two A* nodes at the same cell but
different `exactState` are DIFFERENT nodes; A* explores both as
needed.

To bound the search, cluster `exactState` into an equivalence
class at lookup time: nearby states (Δx < 0.5 px, Δvx < 5 px/s,
Δy < 0.5 px, Δvy < 5 px/s, same onGround) are treated as the
same node for visited / cost-known checks. Tunable; tighter
clustering → larger search, more accuracy.

### 3.2  Edge generation

For each A* expansion of node N:

1. For each of the 46 actions:
   - Simulate the action from `N.exactState` for up to its
     nominal frame budget + 30 frame air-buffer (same as v25's
     simAction).
   - Read endState, outcome, cell.
   - If outcome ∈ {ok, won}, emit an edge with:
     - `to.cellKey` = endCell
     - `to.exactState` = endState
     - `cost` = action's actual frame count
     - `action`, `recording` (= actionToRecording offset by leg
       start frame)
2. Discovered edges feed A*'s open queue.

This is essentially v25's per-edge simulation, but run on demand
instead of in a pre-computed graph. The CALLER never tries to
match an A*-picked edge to a different starting bucket — every
edge was simulated from the exact state A* needed.

### 3.3  Heuristic + termination

Heuristic: Manhattan cell distance to nearest unvisited goal
(same as v22-v27); admissible per the action-graph's cell-resolved
cost lower-bound (= 1 frame per step at walk speed).

Termination conditions (per A* expansion):
- Reached any cell in the current goal cellKey → success.
- Open queue empty → unreachable.
- Total simulated frames exceed `SIM_MAX_FRAMES` (= 2400, the
  v26 budget) → timeout.

Per-leg replan (v27 M5 infrastructure): kept as a no-op
fallback. With per-frame nodes, the live engine's endState
matches reSim's endState by construction, so replan should never
fire. If it does, that's a bug-flag (a frame skew somewhere) —
worth keeping the assert in place.

### 3.4  Multi-goal sequencing

Unchanged from v22 M3: resolveGoals returns an ordered cellKey
list (TSP for K ≤ 4, greedy + 2-opt for K > 4). For each goal,
A* runs from `ctx.position` to that goal. Successive goals
restart A* from the previous goal's terminal exactState.

Cost estimates inside the TSP solver: previously these used
bucket-aware A*. v28 still uses the same A* (which is now
per-frame). For large levels this may make TSP itself
expensive; the v25 M4 budget of 5s primary / 10s escalation
holds.

### 3.5  Recording emission

Unchanged from v27: emitLegInputs threads through the A* path
and re-simulates each step from `prevEndState`. The differences:

- The edge.action's PARAMS came from the A*'s on-the-fly sim,
  so the reSim should land in the exact same place.
- `ctx.position` is now an opaque (cellKey, exactState) handle
  instead of a 4-part stateKey string. The planner-tests
  helper `cellOf` continues to work — cellKey is still 2-part.

## 4. UX in detail

### 4.1  below_ground full solve

Click [Test] on below_ground.txt. Within 5 s (escalation budget
10 s), the dialog shows `✓ Level completable — N solutions`.
Stats: 16 pickups, several solutions possible. Path overlay
traces the full route through both ooo platforms to the exit.

User-invisible change: the planner internally uses per-frame
nodes instead of bucketed nodes.

### 4.2  Other levels — unchanged visible behaviour

`tutorial.txt`, `above_ground.txt`, `simple.txt`, `tower-cherry`
all solve at the same speeds as v27, with the same or
equivalent recordings.

### 4.3  No new editor controls

Per-frame A* is an internal architectural change. The agent
dialog, path overlay, multi-solution display all stay the same.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/agent/grid.js` | `buildNavGraph` retained for spec compliance; produces 9-node identity but the planner doesn't use the edges. Or: removed entirely if no callers depend on it (most likely). Replaced by `expandNode(graph, node)` that simulates 46 actions on demand. |
| `src/agent/planner.js` | A* core rewritten: nodes are `{cellKey, exactState}`; lookups cluster nearby states; edges generated by on-demand `expandNode`. The per-leg replan loop (v27 M5) stays as a no-op safety net. |
| `src/agent/simAction.js` | Unchanged — `simulateActionInContext` is the per-edge integrator. |
| `src/agent/sim.js` | Unchanged — the live-engine replay path. |
| `src/agent/index.js` | Unchanged contract (`testLevel(parsed, legend, opts)` → `{ok, solutions}`). |
| `src/agent/grid.test.js`, `src/agent/planner.test.js` | Most tests still pass — they probe the `plan(parsed, legend)` contract. A handful that inspect `buildNavGraph` directly need to be updated or removed. |
| `tests/v25-edge-state.spec.js`, `tests/v26-bucket-graph.spec.js`, `tests/v27-bucket-graph.spec.js` | If buildNavGraph is removed, these become "v27 legacy-graph spec" or are deleted. If retained, they continue to pass (data model unchanged). |
| `tests/v28-perframe.spec.js` (new) | Asserts A* finds paths on synthetic levels; per-leg endState exactly matches live engine's frame-N position; below_ground.txt solves end-to-end. |
| `tests/v28-below-ground-solves.spec.js` (new) | The acceptance gate — replaces v27's PROGRESS assertion. |
| `TDDs/3_transcripts/version28_build.md` (new) | narrative |

## 6. Open questions — proposed defaults

- **exactState clustering tolerance**: 0.5 px / 5 px·s on (x, y,
  vx, vy); same onGround. Tighter → more accurate, larger
  search; looser → smaller search, possible chain drift.
  **Proposed: 0.5 / 5 / same-onGround**. Tunable; gate at M3
  acceptance.
- **A*'s open-queue size**: per-frame A* may explore many more
  nodes than bucket-aware A*. Budget cap: 100k nodes per plan.
  **Proposed: 100k**. Profile during M2.
- **buildNavGraph retention**: keep as a deprecated export (with
  a console.warn) so test fixtures keep parsing, or delete it
  entirely? **Proposed: retain + deprecate** — the data model is
  still in use by some tests + the visualiser; deleting widens
  the test-update scope.
- **Heuristic admissibility**: Manhattan-cell + a small per-step
  fudge. The cell distance is admissible (player walks ≥ 1
  cell/5-frames). **Proposed: cellDist × WALK_FRAMES_PER_CELL**.
- **TSP order vs. per-frame A* cost**: TSP relies on cost
  estimates that are now full A* searches. For K ≥ 4 pickups
  this could blow the budget. **Proposed**: cap TSP A* depth at
  500 nodes per leg-cost estimate; if exceeded, fall back to
  Manhattan-only estimate.

## 7. Acceptance criteria

### Agent
- **`below_ground.txt` solves end-to-end** — `.badge.ok` within
  5 s (primary) / 10 s (escalation); all 16 pickups collected;
  exit reached.
- **All v21–v27 agent-suite levels continue to solve** — no
  regression on tutorial, above_ground, simple, tower-cherry.
- **No chain divergence**: reSim's endState in emit-leg
  EXACTLY matches the A*'s predicted endState (Δ < 0.001 px,
  Δvx < 0.001 px/s). The v27 M5 per-leg replan assert never
  fires.

### Performance
- **`plan()` time**: ≤ 5 s on shipped levels under the 100k-node
  cap; ≤ 10 s in escalation. Profile + log per-level at M3.

### Tests
- `npm test` green; `npx playwright test` green (existing 113 +
  ≥ 3 new cases).

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **Tileset schema** — unchanged.
- **HUD band** (v27 M2/M3) — unchanged.
- **CSS, fit-mode, theme palette** — unchanged.
- **The LOAD / theme / fit-toggle flows** — unchanged.
- **Multi-solution display + multi-coloured path overlay** —
  unchanged.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v29+ candidates / deferred

- **Reactive theme listener** (OS-pref flips mid-session).
- **`prefers-color-scheme` first-load default** — read at boot
  if no `v23.theme` pref is set.
- **Viewport guide follows mouse**.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence**.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles** (engine change).
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.
- **Update legacy tilesets for v22.1 `imageLocked`** — minor
  carryover.
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval.

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **A* search-space explosion** — per-frame nodes can be huge.
  Mitigation: exactState clustering at lookup time bounds the
  effective node count; 100k-node hard cap; profile + reduce
  clustering tolerance if a level hits the cap without solving.
- **TSP × A* cost blow-up** — TSP estimates now do per-frame A*
  internally. For K ≥ 4 pickups this is K! × per-leg-A*. The
  500-node-per-leg cap mitigates; if a level genuinely needs
  finer TSP ordering, fall back to greedy-only.
- **Heuristic inadmissibility** — if the per-step fudge over-
  estimates, A* may miss optimal paths. Mitigation: use the
  pure cellDist × 5 baseline (admissible) and let A* search
  more nodes.
- **Existing-level regression** — the entire planning core
  rewrites; every level's plan changes. Mitigation: full
  Playwright agent-suite at M3 gate; commit-by-commit
  acceptance.
- **Determinism** — per-frame A*'s tie-breaking among edges
  with equal cost may pick different solutions on different
  runs. Mitigation: tie-break by lexical action name (kind +
  dir + holdFrames) so the search is deterministic.
- **No deploy risk** — bundle stays roughly the same size
  (planner code grows ~3 KB; bucket-graph code shrinks by
  about the same). Same order as v22-v27.
