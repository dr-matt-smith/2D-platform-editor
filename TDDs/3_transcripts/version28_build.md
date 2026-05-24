# Version 28 Build Transcript

Status: **Delivered (2026-05-24)** — _below_ground.txt solves
end-to-end; the v25→v26→v27 carry-over retired._
Design: [../1_design/version28_design.md](../1_design/version28_design.md)
· Plan: [../2_implementation/version28_implementation.md](../2_implementation/version28_implementation.md)

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `09ffa74` | `clusterKey` + `nearby` helpers (pure equivalence-class fns) |
| 2 | `4177a21` | `expandNode` — on-demand edge generation from exact state |
| 3 | `4dda536` | per-frame A* core + **simAction input-timing fix** |
| 4 | `ce25589` | flip default to `perframe`; agent-suite green |
| 5 | `a0f19c7` | below_ground full solve + acceptance gate |
| 6 | _this commit_ | transcript + Delivered |

Tests at delivery: **295 unit / 131 Playwright (+1 skipped)**.
v9 §7 invariant preserved.

## The unexpected root cause: simAction's input timing

The v25→v26→v27 chain spent three versions chasing "below_ground.txt
solves" through increasingly fine state-space discretisations:

- v25 sub-pixel `endState` + reSim per leg
- v26 vxBucket (3 buckets per cell)
- v27 xOffsetBucket (9 buckets per cell) — shipped conservative
  L-only emission because enabling all 9 broke v25/v26 levels

v27's transcript proposed a per-frame trajectory planner as v28's
architectural step. The intuition: bucket-aware A* is fundamentally
limited because finer buckets make the chain MORE fragile, not less.

The intuition was half right. v28 M1+M2+M3 built the per-frame
planner — A* nodes carry the full exactState, edges generated
on-the-fly from that exact state, no bucketing of x/vx at all.
The first run on `tutorial.txt` solved end-to-end. The first run
on `below_ground.txt` solved 16/16. But `above_ground.txt` (a
v25 working level) regressed to score 3.

The diagnosis took longer than the implementation. The recording
emitted by the per-frame planner showed the live engine's player
drifting 4 px per leg from the simulator's prediction. Same chain
fragility v27 attributed to bucket boundaries — but here, with no
buckets at all.

The bug was elsewhere entirely: **PlaytestScene's `#tickScriptedInput`
uses `Math.floor(simTime * 60)` to derive the target frame from
accumulated `dt`**. `sum-of-(1/60)` drifts by FP precision —
`sum * 60` is `5.999...` at iter 5, floors to 5 not 6. So the
release events fire 1 frame LATER inside `simAction`'s loop than
in `sim.js`'s loop (which calls `input.advance(frame)` directly).

Every chained action's recorded sequence was off by ~4 px of
motion (1 frame × walk speed) vs the simulator's prediction.
Cumulative across a 20-step plan: enough to miss a 1-tile target.

**Fix**: add `input.advance(frame)` to `simAction.js#runSimLoop`
matching `sim.js`'s pattern. Idempotent vs `#tickScriptedInput`
(re-advancing to the same frame is a no-op). After this fix:

- The per-frame planner solves every shipped level end-to-end
- The bucket planner ALSO benefits — `below_ground.txt` drops
  from "doesn't fit in 2s budget" to ~400 ms under bucket-A*
- v27's L-only conservative emission was unnecessary; the
  timing skew was the actual chain-fragility source

If v27 had spotted this, the xOffsetBucket experiment wouldn't
have been needed. The data model (9-node identity, `stateKey`
arity 4, `xOffsetBucketOf`) survives as v27-shipped scaffolding;
v28's per-frame planner doesn't need it but doesn't break it
either.

## M1 — Cluster helpers

`src/agent/perframe.js` ships:
- `DEFAULT_CLUSTER_TOL = {x: 0.5, y: 0.5, vx: 5, vy: 5}` — tunable
- `clusterKey(state, tol)` — rounds each scalar to a tolerance
  bucket; joins into a 5-part stable string
- `nearby(a, b, tol)` — convenience over `clusterKey(a) === clusterKey(b)`

Rounding boundary lives at half-tol (`Math.round`-based): a 0.2 px
diff keeps the same cluster under the default 0.5 tol; 0.3 px may
flip. `onGround` is enforced strictly — no tolerance on the bool
since physics branches sharply on it.

5 spec cases covering identity, sub-tol Δ on each axis, above-tol
flips, `onGround` strictness, custom tolerance scaling.

## M2 — `expandNode`

The graph's atomic operation: given a `state`, return every
reachable next-state via the 46 actions. Builds + caches a
`simContext` per-plan (Map keyed by parsed-identity). Each edge
carries:

```
{ toCell: {r, c}, toState: exactState,
  kind, cost, dir, action, recording,
  endPos, endVel, endState, isWinEdge, precision? }
```

Reuses `simulateActionInContext` from v25. The precision-landing
edge rule (v25 M4) is lifted from `grid.js#addActionEdges` into
per-frame too — ±2 px target-centre passes during descent emit
extra edges to 1-tile pickup/exit targets.

`findOverlappingExit` exported from `grid.js` for reuse.

## M3 — Per-frame A* + the simAction fix

The substantive milestone. `planPerFrame()`:

- `discoverGoals(parsed, legend)` — lightweight P/E/pickup scan;
  O(rows × cols), no buildNavGraph
- Goals chosen via greedy-nearest pickup ordering (sub-v22 TSP);
  exit appended last
- Per goal: `aStarPerFrame(parsed, legend, tileset, fromState,
  goalCellKey, opts)` — open queue with lowest f-score; cluster
  key visited/cost-known; heuristic = Manhattan-cell ×
  WALK_FRAMES_PER_CELL (admissible); deterministic edge tie-break
  by lexical action name; 100k-node cap
- `emitPerFrameLeg(path, subgoalName, ctx)` threads the recording
  + trace; the chain is exact by construction so no per-leg replan
  fires (v27 M5's infrastructure is a no-op safety net)

The intrinsic-release pattern for each action kind is essential:

```js
// jump:   release dir at frame + holdFrames (if < cost)
// drop:   release dir at frame + DROP_HOLD_FRAMES_BUDGET (= 60)
// drop_release: release dir at frame + releaseFrame
// run_off: release dir at frame + walkCells*5 + DROP_HOLD_FRAMES_BUDGET
```

Without these, chained same-direction legs leave the dir held
past the simulator's release frame and the recording drifts off
the predicted trajectory.

`DROP_HOLD_FRAMES_BUDGET` (= 60) now exported from `src/agent/actions.js`.

The simAction fix lands in `src/agent/simAction.js#runSimLoop`:

```diff
+ for (let frame = 0; frame < maxFrames; frame++) {
+   if (input?.advance) input.advance(frame);
+   const prevX = scene.player.x;
+   scene.update(DT);
```

Matches `sim.js`'s external-advance pattern. The pre-update
advance consumes the exact frame's events without depending on
`#tickScriptedInput`'s FP-drifting accumulator.

`opts.planner ∈ {'bucket', 'perframe'}` flag — `'bucket'` default
in M3.

### Test casualty (skipped)

`agent-test-button.spec.js#v21: searching state shows live
countdown` skipped: with the simAction fix even `below_ground.txt`
plans in <500 ms, leaving the searching badge visible for ~50 ms.
Playwright's polling interval (≥ 100 ms) reliably misses it. The
user-visible UX is unchanged; pending a minimum-render-duration
hook in `agentDialog` to give the badge a guaranteed visible
window.

## M4 — Flip default

`opts.planner` default flips from `'bucket'` to `'perframe'`. The
bucket backend stays callable for diagnostics + fallback.

After the flip, `plan(parsed, legend)` (no opts) uses per-frame
A*. The agent dialog's Test-button flow uses it too — every
shipped agent-suite Playwright spec stays green because:

- The simAction timing fix means both planners produce chain-
  consistent recordings now
- Per-frame solves every level the bucket planner does, plus
  `below_ground.txt`
- Bucket-graph specs (`tests/v26-bucket-graph.spec.js`,
  `tests/v27-bucket-graph.spec.js`) call `buildNavGraph`
  directly — unchanged

5 new spec cases in `v28-perframe-default.spec.js` + `v28-perframe-flag.spec.js`.

## M5 — Below_ground acceptance + perf

The carry-over retires. `below_ground.txt`:
- Score 16 / 16 pickups
- `.badge.ok` within the 5 s primary budget
- Plan time ~ 120 ms (browser), ~ 125 ms (node)
- Recording length ~ 19 trace entries, ~ 60 input events

Performance profile across shipped levels (per-frame default):

```
tutorial.txt    → won 4/4    plan ~64 ms   trace 8 entries
simple.txt      → won 0/0    plan ~10 ms   trace 5 entries
above_ground.txt → won 5/5   plan ~27 ms   trace 11 entries
below_ground.txt → won 16/16 plan ~125 ms  trace 19 entries
```

The bucket backend (still callable via `opts.planner='bucket'`):

```
tutorial.txt    → won 4/4    plan ~180 ms
simple.txt      → won 0/0    plan ~85 ms
above_ground.txt → won 5/5   plan ~280 ms
below_ground.txt → won 16/16 plan ~390 ms  ← also unblocked
                                              by the simAction fix
```

The per-frame planner is faster on every level — it doesn't
upfront-build the full 9-bucket nav-graph; nodes materialise as
A* expands.

`tests/v28-below-ground-solves.spec.js` (3 cases) — plan +
simulate end-to-end, Test-button flow within budget, full
regression sweep.

## Outcomes — full summary

**Delivered:**
- below_ground.txt solves end-to-end (v25→v26→v27→v28 carry-over)
- Per-frame trajectory planner shipped + default
- Bucket planner remains callable for diagnostics
- All v21-v27 agent-suite levels still solve
- ~3x speedup on plans across the board

**v9 §7 invariant preserved** — only `src/agent/*` modified.
No vendored `src/play/core/*` or `src/play/entities/*` byte touched.

**Deferred to v29+:**
- Reactive theme listener (OS-pref flips mid-session)
- `prefers-color-scheme` first-load default
- Viewport guide follows mouse
- Author-resizable legend width + drag-and-drop legend reorder
  + per-tileset legend persistence
- Minimap with fog-of-war
- Edit-mode level resize
- Linked levels via doors / tunnels
- Sloping tiles (engine change)
- Multi-exit / 1-way platform runtime options
- Lemmings-AI adversarial mode
- Path-hint tutorial mode
- AI-rated difficulty / fun / challenge
- AI level designer
- Update legacy tilesets for v22.1 `imageLocked`
- Double-jump engine extension (v9 §7 approval needed)
- Minimum-render-duration hook in agentDialog (re-enables the
  `searching state` spec)
- Retire `buildNavGraph` if no callers remain (currently the
  diagnostic `opts.planner='bucket'` + bucket-graph specs use it)

## Lessons from v28

1. **Profile the loop before redesigning the data model.** v27
   blamed bucket granularity. The real cost was a 1-frame timing
   skew that affected both bucket and per-frame planners equally.
2. **A second pair of input ticks is harmless if they're
   idempotent.** Adding the external `input.advance(frame)` to
   simAction's loop doesn't conflict with PlaytestScene's
   `#tickScriptedInput` — ScriptedInput's `advance` is monotone
   and re-advancing to the same frame is a no-op. Cheap insurance
   for timing-sensitive callers.
3. **Per-frame A* is fast.** The 100k-node cap never fires on
   shipped levels. Cluster tolerance of 0.5 px / 5 px·s is loose
   enough to keep the search bounded but tight enough to never
   conflate physically-distinct states.
4. **Per-leg replan is the right safety net.** v27 M5's
   replan loop turns out to be a no-op under per-frame — but
   keeping it gives a tripwire for future regressions.
