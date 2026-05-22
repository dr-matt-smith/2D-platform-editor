# 2D Level Designer — Version 21 Design Document

Status: Proposed · Date: 2026-05-22 · Builds on:
[version20_design.md](version20_design.md) (AI level-tester agent)
· Implementation: *to follow once this scope is approved*.

## 1. Purpose

Make the v20 AI level-tester agent **solve more complex levels** —
specifically the multi-platform, vertical-traversal, jump-precision
scenarios the v20 + v20.1 planner can't handle. The shipped
`tutorial.txt`, `above_ground.txt`, and the user-reported "cherry
on a 3-wide tower" level all sit in v20's "no solution found"
bucket; v21's acceptance criterion is that **all three solve**.

The wishlist constraint from v20 is preserved: explainable trace,
rule-based planning (no machine learning), demonstrable via the
existing Demo replay button. v21 changes **how the planner builds
its graph**, not its output shape — the `Solution` returned to the
dialog has the same trace + recording + stats fields v20 exposed.

**Out of scope for v21**: multi-solution enumeration, TSP-optimal
pickup ordering, author-difficulty rating, per-tileset agent
capabilities. These remain v22+ carry-forwards. v21 is a single-
feature release focused on planner accuracy.

## 2. Current state — why v20 fails complex levels

The v20.1 planner already has:
- Per-`dr` parabolic envelope (`maxDcForDr` table, v20.1).
- Parabola arc-path validation (`isParabolaClear`, v20.1).
- 10-attempt replan budget, 1200-frame sim limit (v20.1).

But the **graph model itself** is the bottleneck:

1. **Cell-pair edges assume discrete landings.** An edge says
   "from cell A jump to cell B". The recording emits "press space
   + hold direction for full arc". But the engine's physics:
   - Holds `vx = ±SPEED` for as long as the direction key is
     held.
   - Lands wherever the descending arc meets a `#` platform top.
   - Doesn't stop precisely at the agent's target cell.

   Result: the player overshoots/undershoots; the next planned
   action assumes a position the player doesn't actually occupy.
   v20.1's sim-validate + replan loop catches the mismatch but
   has no productive way to fix it — every replan proposes the
   same kind of mismatched plan.

2. **No "release direction mid-jump" model.** Real platformer
   players can release the direction key mid-jump to land
   precisely. v20's planner has no representation of this — every
   jump holds direction for the full arc.

3. **No sub-cell position tracking.** The planner thinks in
   discrete cells; the engine thinks in continuous pixels. A
   jump that lands at `xPx = 83.7` is "cell 4" to the planner
   but the next walk-right edge starts from `cell 5`'s pixel
   center, immediately drifting from reality.

4. **Goal ordering is cell-based, not pixel-based.** When the
   agent collects a pickup en route to a goal, the score
   increments but the "current goal" pointer doesn't update
   until the planned target cell is reached.

The shipped `tutorial.txt` exemplifies all four: P spawns
mid-air at `(2, 4)`, falls past sky and small platforms to land
on the main floor `(8, ~7)` (drift during fall), then needs to
jump-up onto a `######` stepping-stone platform, walk along it,
jump-up onto a higher ledge, walk to the exit. v20.1 can plan
parts but the action-sequence never executes cleanly.

## 3. Approach — action-sequence edges

Replace the v20 cell-pair edge with an **action-sequence edge**:

```
Edge = {
  startCell:   { r, c },      // grounded cell where the action begins
  action:      { kind, params },
  endCell:     { r, c },      // determined by physics, not chosen
  endPos:      { xPx, yPx },  // sub-cell landing for next leg's accuracy
  recording:   [ { frame, key, down } ],
  cost:        framesElapsed,
  why:         "explainable string",
}
```

Action kinds:

| `kind` | `params` | Meaning |
|---|---|---|
| `walk` | `{ dir, cells }` | hold `dir` for `cells × 5` frames |
| `jump` | `{ dir, holdFrames }` | press space + hold `dir` for `holdFrames` frames, then release; arc completes regardless |
| `wait` | `{ frames }` | release everything, let physics settle (e.g. wait to land after a drop) |
| `drop` | `{ dir, cells }` | walk off a ledge, hold direction during fall |

For each grounded cell + direction + key release-frame combination,
the planner **simulates the resulting trajectory ONCE during
nav-graph construction**, records the actual landing cell + position
+ frame count, and adds an edge. The simulator IS the source of
truth — no more "agent thinks vs physics says" drift.

Practical pruning:
- `walk`: 1–8 cells (longer walks decompose into sub-edges).
- `jump`: 2 directions × ~12 release-frame choices = 24 jump
  actions per cell. Release frames `{2, 4, 8, 12, 16, 20, 24, 28,
  32, 36, 40, 42}` (full-arc is 42 frames at 60 fps).
- `drop`: enumerated per ledge.

This yields ~30 outgoing edges per grounded cell instead of v20's
~9. For a 24×14 level (~250 grounded cells), the nav-graph has
~7500 edges — A*-tractable in milliseconds.

### 3.1 The release-direction-mid-jump unlock

The user's tower level illustrates the win. From `(9, 11)`,
v20 considers `jump_left_full_arc` only — lands at `(9, 11-8) =
(9, 3)`, far past the tower. v21 considers the family
`jump_left_release_at_{2..42}` — release-at-frame-26 yields
`vx=0` mid-arc, the player continues vertically and lands
precisely on the tower top at `(6, 5)`. The agent picks that
edge and the plan executes physically.

### 3.2 Sub-cell continuity

`endPos` records the player's exact `(xPx, yPx)` after the action
completes. The next edge from `endCell` uses `endPos` as its
*starting* state (not `endCell × TILE`), so position drift can't
accumulate across legs. A* still operates on cells (the discrete
graph), but each cell-state carries its precise pixel position +
velocity for the next-edge simulation.

### 3.3 Headless sim becomes the graph builder

A single `simulateAction(parsed, legend, tileset, startPos, action)`
runs the engine for the action's duration, returns
`{ endCell, endPos, success }`. The v20 `simulate()` (full-
recording validation) is unchanged — but used differently:
- v20 used it to **validate** a plan after planning.
- v21 uses `simulateAction` (a per-edge version) to **build** the
  graph; the final plan is provably correct by construction.

The runner's replan logic survives as a safety net for edge cases
(e.g. floating-point quirks), but should fire rarely.

## 4. UX — countdown timer + tiered budget escalation

v21 keeps the v20 surface (one `[Test]` toolbar button, same dialog
shape, same path overlay) but adds a **visible time budget**:

1. Clicking `[Test]` immediately opens a "Searching for a solution"
   dialog with a **live countdown timer**. The default initial
   budget is **5 seconds**.
2. While the countdown is live, the agent works in chunks (graph
   build per cell, A* expansion per ~50 nodes, replan attempts).
   The timer ticks down by `0.1s` increments.
3. **On success**: the dialog transitions to the v20 success state
   (badge + stats + Demo button + trace) immediately.
4. **On failure** (no solution within budget): the dialog shows
   `✗ No solution within Ns` plus three escalation buttons:
   **[Try 10s] [Try 15s] [Try 20s]**. Clicking any restarts the
   agent with that budget; the countdown resumes.
5. Esc/backdrop/Close cancel; the agent's async loop notices and
   bails on the next yield point.

What the user sees on the trace + overlay (unchanged structure,
richer content):
- More levels return `✓ Level completable` where v20 returned
  `✗ No solution found`.
- The dialog's trace entries may show new `kind` values: `walk`,
  `jump` (with release-frame info in `why:`), `drop`, `wait`.
- The path overlay's polyline traces the true parabolic arcs
  (sub-cell accuracy), not just cell-center linear segments.

### 4.1  How more time helps

The v21 agent is **deterministic per (level, graph, goal-ordering)**.
Longer budgets unlock extra work in three places:

| Extra time spent on… | What it buys |
|---|---|
| Larger candidate set per cell | More release-frame choices in the jump-action enumeration (e.g. `{2, 4, …, 42}` extended to `{1, 2, 3, …, 42}` — finer landing precision) |
| Goal-ordering search | When `# pickup-required: K of N`, try multiple subsets/orderings (combinatorial); greedy nearest-first runs first, alternatives if time permits |
| Replan budget | More attempts to recover from floating-point edge cases; cheap insurance against rare drift |

The 5s default fits most v21-scope levels comfortably. The 10/15/20s
ramps exist for tricky levels where the agent needs to try multiple
goal orderings before finding one that satisfies physics.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/agent/grid.js` | Major rewrite. `buildNavGraph(parsed, legend, tileset)` now uses `simulateAction` to derive edges; nodes carry pixel positions. Existing `maxDcForDr` + `isParabolaClear` retained as analytic guides for filtering before full simulation. |
| `src/agent/actions.js` (new) | The action-kind taxonomy + `enumerateActions(cell)` that yields candidate (kind, params) tuples. Used by graph builder. Also `actionToRecording(action, frameStart)` converts an action to ScriptedInput events. |
| `src/agent/simAction.js` (new) | `simulateAction(parsed, legend, tileset, startPos, action)` mints a small headless PlaytestScene-like simulator (or reuses sim.js) to step the engine through the action's duration. Returns landing cell + pixel-precise position + collision flags. |
| `src/agent/planner.js` | A* state changes from `string("r,c")` to a richer node identifier; trace entries gain `endPos`, `release` field, `holdFrames`. `replan` semantics unchanged. |
| `src/agent/runner.js` | Mostly unchanged — still drives plan → simulate → replan. The full-recording `simulate()` becomes a **final validation pass** rather than the primary correctness check. `replanBudget` can drop back to 3 once edges are correct-by-construction. |
| `src/agent/overlay.js` | Polyline uses `endPos` (pixel-precise) instead of cell centers. Jump arcs render as proper parabolas (interpolated between recorded frames). Numbered markers unchanged. |
| `src/agent/sim.js` | Unchanged. Used by simAction.js as a building block; also still drives the final validation pass. |
| `src/agentDialog.js` | Trace renderer slight extension: `why:` strings for jump entries include the release-frame info; renderer reads `action.params` to format the entries naturally. |
| `tests/agent-test-button.spec.js` | Existing 4 cases unchanged. New cases: tutorial.txt solves, above_ground.txt solves, the tower-cherry level solves (record-and-replay the agent's recording to confirm WIN). |
| `src/agent/*test.js` | New unit cases per module: actions enumeration coverage; simAction returns expected landing for known scenarios; planner produces release-frame-aware traces. |

## 6. Open questions — proposed defaults

- **How many release-frame choices?** Proposed **12** (`{2, 4,
  8, 12, 16, 20, 24, 28, 32, 36, 40, 42}`) — enough for cell-
  precision landings, small enough for A*-tractable graphs.
  A more uniform spacing (`{2, 6, 10, ..., 42}`) is also fine.
- **Should `wait` be a first-class action?** Proposed **yes** —
  needed for "fall-and-wait-for-platform" scenarios. Cost = N
  frames idle.
- **Pre-compute graph per buffer change?** Proposed **lazy** —
  build only when `[Test]` is clicked. Cache across consecutive
  clicks if the buffer is unchanged.
- **Cache invalidation?** Hash the parsed grid + meta; rebuild
  on hash change.
- **Should the cache survive page reload?** Proposed **no** —
  in-memory only; rebuild on next click.
- **What if the user changes pickup-required between Test clicks?**
  Different goal queue, same graph. Cache reuses the graph;
  planner re-runs goal-sequencing.
- **What about levels with the v18 `# background-image:` /
  v19 `# viewport:` directives?** Unchanged — they don't affect
  physics, the planner ignores them.
- **Drop edges from row-9 to lower floors** — should the
  simulator allow falling off the bottom of the world to
  enumerate "dies trying"? Proposed **no** — only land on
  in-bounds platforms; off-world drops are not edges.
- **Animator-driven sprites** — agent doesn't care about
  visuals; reads only physics.

## 7. Acceptance criteria

- **`tutorial.txt` solves**: the agent visits the `oooo` pickup
  row (collecting all 4 pickups), reaches the `E` exit. Trace
  entries include at least one `jump_release_at_M` action.
- **`above_ground.txt` solves**: same.
- **The user's tower-cherry level solves**: cherry collected
  AND player reaches the exit. v20.1's "cherry collected but
  exit unreached" upgraded to fully solved.
- **No regression on the v20-solvable set**: trivial walk,
  flat-multi-pickup, `simple.txt`, all `agent-test-button`
  Playwright cases continue passing.
- **Search runtime under 1s** on a 40×24 level (~960 cells).
  Cache hit on second click of same buffer = sub-100ms.
- **Demo replay is pixel-faithful**: the recorded keypress
  sequence, played back in live engine, ends with `phase=won`
  at the same frame the planner predicted (±2 frames for
  floating-point drift).

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Tileset schema** — unchanged.
- **The vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved. The new
  `simAction` reuses `PlaytestScene` exactly as v20 does.
- **The UI** — same `[Test]` button, same dialog shape, same
  overlay layer. The trace list's content gets slightly richer
  (release-frame info in jump entries) but the structure is
  unchanged.
- **The v20 Demo mode + ScriptedInput** — unchanged. Demo
  drives the recording exactly as v20 does; the recording is
  now correct-by-construction, so Demo always succeeds.
- **The Tileset / Level dropdowns + the v8-v19 features** —
  all untouched.

## 9. v22+ candidates / deferred

- **Multi-solution enumeration** — locked v22 acceptance
  criterion (the user's wishlist note). The action-sequence
  model makes this easier: enumerate K shortest distinct paths
  via Yen's algorithm on the action-graph.
- **TSP-optimal pickup ordering** — combine with the
  multi-solution work.
- **Learning physics empirically** — instead of reading
  `constants.js` values, the agent could probe the engine for
  jump arcs at startup. Useful if future tilesets get
  per-character physics tweaks.
- **Backtracking around walls** (collect-key-then-return) —
  needs a richer goal model (key/door state).
- **Author-difficulty rating** — `{ steps, jumps, replans,
  release-precision-required }` → ★☆☆☆☆.
- **Web Worker for big-world graph build** — only if needed.
- **Multi-level cross-agent** — pairs with v22+ doors / tunnels.
- **Animated decoration support** — agent treats decorations
  as inert (unchanged from v20).

Plus the long-standing v16/v17/v18/v19 carry-overs:
- Damped/look-ahead camera, parallax backgrounds.
- Decoration-image free placement.
- Layered z-order with named layers.
- Per-cell animation phase offset.
- Multi-row tile atlases.
- State-changing exit.
- v17 dead-end `caretLineCol` cleanup.

## 10. Risks

- **Graph build cost.** For a 40×24 level with ~700 grounded
  cells × 30 actions/cell = ~21k edge-sim runs. Each sim is
  ~50µs (no rendering, ~5 ticks), so total ≈ 1 second. Within
  the 3-second user budget but tight. Mitigation: cache
  aggressively + parallelize via small async batches if
  perceivable.
- **State space explosion in A***. With pixel-precise edge
  ends + velocity, the state space is technically continuous.
  Mitigation: A* still operates on `(cell, vy_bucket)`
  identifiers — quantizing vy to {0, fast-down} keeps the
  state count tractable.
- **Floating-point determinism**. Two runs of the same
  simulation produce the same output (JavaScript's float math
  is bit-deterministic per spec). Cross-browser drift is in
  principle possible but unattested for our use; the final
  validation pass catches any divergence and triggers replan.
- **Edge cases the discrete cell model glossed over** become
  visible. E.g. a player landing precisely on a cell boundary
  (xPx = N × TILE) — engine resolves consistently; agent must
  too. Mitigation: round endPos consistently using `Math.round`
  at edge boundaries.
- **Backwards compatibility with v20 tests.** Some v20 tests
  asserted v20's discrete-cell model behaviour. Each will be
  reviewed: a few may need updating to assert the new
  (more accurate) behaviour. The four `agent-test-button`
  Playwright cases should be unaffected (they exercise the
  public API, not the internal graph).
- **No deploy risk.** Bundle grows by ~3–5KB (actions.js +
  simAction.js, mostly enumeration tables). Pages workflow
  unchanged.

## 11. Why this design satisfies "solve more complex levels"

The v20 transcript's explainable-WHY constraint stays satisfied
(every action carries `why:`; trace remains a goal stack). The
material change is that **the planner's edges are physically
achievable by construction**. v20's gap — "plan looks valid on
the cell grid but the engine disagrees" — is closed at its
source: the engine **is** the edge-generator now.

This is the smallest architectural change that lifts v20's
"complex level" ceiling. Future versions can layer richer
features (multi-solution, TSP, learning physics) on top of the
same action-graph foundation without revisiting it.
