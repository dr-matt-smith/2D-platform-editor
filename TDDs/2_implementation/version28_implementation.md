# Version 28 — Implementation Plan

Status: **Delivered (2026-05-24)** · Design:
[../1_design/version28_design.md](../1_design/version28_design.md)
· Transcript:
[../3_transcripts/version28_build.md](../3_transcripts/version28_build.md)

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `09ffa74` | clusterKey + nearby helpers |
| 2 | `4177a21` | expandNode — on-demand edge generation |
| 3 | `4dda536` | per-frame A* core + simAction input-timing fix |
| 4 | `ce25589` | flip default planner to perframe |
| 5 | `a0f19c7` | below_ground full solve + acceptance gate |
| 6 | _this commit_ | transcript + Delivered |

Tests at delivery: 295 unit / 131 Playwright (+1 skipped).
**below_ground.txt solves end-to-end (16/16 pickups, <500 ms)** —
the v25→v26→v27 carry-over is retired. v9 §7 invariant preserved.

Six path-scoped commits. The planner rewrite lands behind a feature
flag (M3) so the existing bucket-aware path stays default until M4
flips it; this keeps each commit reviewable + reversible. M5 is the
below_ground acceptance gate the v25→v26→v27 chain has been chasing.

| M | Deliverable |
|---|-------------|
| 1 | `clusterKey(exactState)` + `mergeNearby` helpers + spec |
| 2 | `expandNode(parsed, legend, tileset, state)` — on-demand edge gen wrapping simAction |
| 3 | Per-frame A* core (`planPerFrame()`); FLAG-gated; bucket-A* stays default |
| 4 | Flip default → per-frame; v21-v27 agent-suite regression sweep |
| 5 | below_ground full solve + perf budget + bucket-graph spec retirement |
| 6 | acceptance + transcript + Delivered |

Tests at delivery target: 295+ unit / 116+ Playwright (existing 113 +
≥ 3 new). v9 §7 invariant preserved (only `src/agent/*` changes).

## Process (same discipline as v8–v27)

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
  and `src/play/entities/*`** preserved. v28 only touches
  `src/agent/*`.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - M1 (clustering helpers) is pure — no integration. Existing
    bucket-aware planner is untouched.
  - M2 (`expandNode`) is also pure — no integration; calling it
    is opt-in.
  - M3 (`planPerFrame()` behind a flag) ships the new core but
    doesn't change `plan()`'s default behaviour. Tests opt in
    explicitly.
  - M4 (flip default) is the riskiest. The full Playwright
    agent suite plus all v21-v27 specs must continue green.
    Mitigation: M3 spec sweeps the new path against EVERY
    shipped agent-suite level under the flag before M4 flips.
  - M5 acceptance gate — below_ground.txt MUST solve. If the
    new planner can't, M5 ships partial + documents (v29
    candidate); previous milestones already enabled the new
    path without breaking the old.
- **Feature flag mechanism**: `plan(parsed, legend, opts)` gains
  `opts.planner` — `'bucket'` (default) | `'perframe'`. Existing
  callers use the default and stay byte-identical. M4 changes
  the default.
- **exactState clustering**: tolerances proposed in design §6 —
  Δx < 0.5, Δy < 0.5, Δvx < 5, Δvy < 5, same onGround. Pure
  hash function over rounded values so two nearby states map to
  the same clusterKey.
- **A* node identity**: cluster key is the "visited / cost-known"
  identity; the actual node carries the full exactState used as
  the next leg's seed.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/agent/perframe.js` (new) | `clusterKey({x, y, vx, vy, onGround}, tol)` returns a string key with each scalar rounded to its tolerance bucket; `mergeNearby(stateA, stateB, tol)` returns true if both fall in the same cluster | M1 |
| `tests/v28-cluster.spec.js` (new) | Asserts identical states cluster identically; 0.49-px diff in any axis clusters identically; 0.51-px diff clusters distinctly; onGround flips break clustering | M1 |
| `src/agent/perframe.js` | `expandNode(parsed, legend, tileset, state, opts)` returns an array of `{ to: state', edge: {action, cost, kind, dir, recording, endState, endPos, endVel, isWinEdge, precision} }`. Internally creates / reuses a simContext (cache by parsed-identity) and runs all 46 actions through `simulateActionInContext`. Per-edge precision-landing emission (same rule as v25 M4) | M2 |
| `tests/v28-expand.spec.js` (new) | On `#####\n#P.E#\n#####`, expanding the spawn state yields walk_left + walk_right + jumps + win edges with the cell-correct endpoints + endStates | M2 |
| `src/agent/perframe.js` | `planPerFrame(parsed, legend, tileset, opts)` runs A* with `(cellKey, clusterKey)` as the "visited" key and `exactState` carried per node. Heuristic = `cellDist × WALK_FRAMES_PER_CELL`. Goal acceptance = cell-prefix match (any clusterKey of the goal cell). Node cap = 100k; per-leg time cap derives from `opts.budgetMs` | M3 |
| `src/agent/planner.js` | `plan()` gains `opts.planner ∈ {'bucket','perframe'}`. `'bucket'` (default) keeps the v27 code path BYTE-IDENTICAL. `'perframe'` dispatches to `planPerFrame` for each goal in the resolveGoals chain; emit-leg path stays the same | M3 |
| `tests/v28-perframe-flag.spec.js` (new) | With `opts.planner = 'perframe'`, simple levels (tutorial, above_ground, simple) all solve | M3 |
| `src/agent/planner.js` | Flip default `opts.planner` to `'perframe'`. Old bucket-A* stays callable via `'bucket'` opt for diagnostic / fallback use | M4 |
| `tests/v28-perframe-default.spec.js` (new) | Without `opts.planner`, plan uses the per-frame path; agent-suite levels all solve | M4 |
| Existing agent suite (v21–v27 specs) | All cases continue to pass under per-frame as the default | M4 gate |
| `src/agent/perframe.js` | Performance pass: cluster tolerances tuned per `SIM_MAX_FRAMES=2400`; below_ground.txt budget tracked | M5 |
| `tests/v28-below-ground-solves.spec.js` (new) | below_ground.txt solves end-to-end in ≤ 5 s (primary) or ≤ 10 s (escalation); replaces v27's PROGRESS assertion | M5 |
| `src/agent/grid.js` | `buildNavGraph` retained-but-deprecated; export a `legacy: true` flag. Bucket source-node gate (M4 conservative L-only) removed since the function is no longer the primary planner backend | M5 |
| `tests/v27-bucket-graph.spec.js`, `tests/v26-bucket-graph.spec.js` | Updated to call buildNavGraph with `{ legacy: true }` or moved to a "legacy specs" suite — both options gate at M5 review | M5 |
| `TDDs/3_transcripts/version28_build.md` (new) | narrative covering M1–M5 | M6 |

## Milestone 1 — Cluster helpers

Pure-function plumbing. Sets up the equivalence-class machinery the
A* will use.

1. Create `src/agent/perframe.js`:
   ```js
   export const DEFAULT_CLUSTER_TOL = {
     x: 0.5, y: 0.5, vx: 5, vy: 5,
   };
   export function clusterKey(state, tol = DEFAULT_CLUSTER_TOL) {
     const cx = Math.round(state.x / tol.x);
     const cy = Math.round(state.y / tol.y);
     const cvx = Math.round(state.vx / tol.vx);
     const cvy = Math.round(state.vy / tol.vy);
     return `${cx},${cy},${cvx},${cvy},${state.onGround ? 1 : 0}`;
   }
   export function nearby(a, b, tol = DEFAULT_CLUSTER_TOL) {
     return clusterKey(a, tol) === clusterKey(b, tol);
   }
   ```
2. `tests/v28-cluster.spec.js` (new):
   - clusterKey({x:100, y:50, vx:0, vy:0, onGround:true}) returns a stable string.
   - {x:100.4, vx:4} clusters identical to {x:100.5, vx:4}.
   - {x:100.6, vx:0} clusters DIFFERENTLY from {x:101.0, vx:0}.
   - {onGround:true} clusters DIFFERENTLY from {onGround:false}.
3. Verify: `npm test`, `npx playwright test`.

Path-scoped commit:
```
git add src/agent/perframe.js tests/v28-cluster.spec.js
git commit -m "v28 m1: exactState clustering helpers (clusterKey + nearby)"
```

## Milestone 2 — expandNode (on-demand edge generation)

The graph's atomic operation: given a state, return all reachable
next-states. No A*, no chaining — just one simAction sweep.

1. `src/agent/perframe.js`:
   ```js
   import { enumerateActions, actionToRecording } from './actions.js';
   import { makeSimContext, simulateActionInContext } from './simAction.js';
   import { vxBucketOf, xOffsetBucketOf } from './grid.js'; // optional, for traces
   
   export function expandNode(ctxCache, parsed, legend, tileset, state, opts = {}) {
     const ctx = ctxCache.get(parsed) ?? (() => {
       const c = makeSimContext(parsed, legend, tileset);
       ctxCache.set(parsed, c);
       return c;
     })();
     const edges = [];
     for (const action of enumerateActions()) {
       const result = simulateActionInContext(ctx, state, action, opts);
       if (result.collided) continue;
       if (result.outcome !== 'ok' && result.outcome !== 'won') continue;
       // ... cell + isWinEdge resolution (same logic as grid.js addActionEdges)
       edges.push({
         to: { cell: { r, c }, state: result.endState },
         kind: action.kind,
         dir: action.params.dir,
         cost: result.cost,
         action,
         recording: actionToRecording(action, 0),
         endState: result.endState,
         endPos: result.endPos,
         endVel: result.endVel,
         isWinEdge,
       });
     }
     return edges;
   }
   ```
2. Reuse the precision-landing emission rule from v25 M4 (lift the
   logic out of grid.js#addActionEdges as a shared helper).
3. `tests/v28-expand.spec.js` (new):
   - expandNode on `#####\n#P.E#\n#####` from spawn state yields
     walk_left, walk_right, jump variants, and at least one
     win-edge to the exit cell.
   - Cell of each returned edge matches the simulated endpoint.
   - Edge endStates are deterministic (re-call returns same).

```
git commit -m "v28 m2: expandNode — on-demand edge generation from exact state"
```

## Milestone 3 — Per-frame A* core (FLAG-gated)

The planner rewrite, gated behind `opts.planner = 'perframe'`. The
default (`'bucket'`) keeps v27's byte-identical behaviour.

1. `src/agent/perframe.js`:
   ```js
   export function planPerFrame(parsed, legend, tileset, opts = {}) {
     const startState = { x: ..., y: ..., vx: 0, vy: 0, onGround: true };
     const goals = resolveGoals(...); // reuse v22 logic via planner.js
     for (const goal of goals) {
       const path = aStarPerFrame(parsed, legend, tileset, ctx.state, goal, ...);
       emitLegInputs(path, subgoalName, ctx);
     }
   }
   
   function aStarPerFrame(parsed, legend, tileset, fromState, goalCellKey, opts) {
     const open = ...; // priority queue by f-score
     const cameFrom = new Map(); // clusterKey → {from, edge}
     const gScore = new Map();   // clusterKey → cost-so-far
     const ctxCache = new Map(); // reused across A* iterations
     // ...
   }
   ```
2. `src/agent/planner.js`:
   - `plan(parsed, legend, opts = {})` reads `opts.planner` (default
     `'bucket'`).
   - On `'perframe'`, dispatch to `planPerFrame(parsed, legend, ...)`.
   - On `'bucket'`, the existing code path runs unchanged.
3. `tests/v28-perframe-flag.spec.js` (new):
   - For `tutorial.txt`, `above_ground.txt`, `simple.txt`:
     `plan(parsed, legend, { planner: 'perframe' })` returns a
     recording; `simulate({recording, ...})` outcome === 'won'.
4. Profile: log per-level node count + planning time at the bottom
   of the spec (informational; gate at M5).
5. No regression — full Playwright suite passes (default flow
   unchanged).

```
git commit -m "v28 m3: per-frame A* core (planPerFrame); flag-gated, default stays bucket"
```

## Milestone 4 — Flip default; v21-v27 regression sweep

The cutover. Switch `opts.planner` default from `'bucket'` to
`'perframe'` and verify EVERY shipped agent-suite spec still passes.

1. `src/agent/planner.js`:
   - Change the default: `opts.planner = opts.planner ?? 'perframe'`.
   - `'bucket'` still callable for diagnostics / fallback.
2. `tests/v28-perframe-default.spec.js` (new):
   - `plan(parsed, legend)` without `opts.planner` exercises the
     per-frame path. Assert via a sentinel that the per-frame
     code ran (e.g., expose a `lastPlannerUsed` symbol).
3. Existing agent-suite regression (full Playwright):
   - v22 multi-solution
   - v23 fit-play, action-graph
   - v24 multi-colour, tutorial-solve
   - v25 edge-state, sim, precision-landing
   - v26 bucket-graph (with `opts.planner = 'bucket'` to keep
     testing the legacy backend; new tests cover per-frame)
   - v27 hud-geometry / hud-row / bucket-graph / below-ground
4. If any spec regresses, fix BEFORE moving to M5. Likely culprits
   are precision-landing edge cases or TSP cost ordering — both
   are testable in isolation.

```
git commit -m "v28 m4: flip default to per-frame planner; agent-suite regression gate held"
```

## Milestone 5 — below_ground full solve + perf

The acceptance gate. The carry-over from v25 → v26 → v27.

1. `tests/v28-below-ground-solves.spec.js` (new):
   - Fetch `below_ground.txt`.
   - `plan(parsed, legend)` returns a recording.
   - `simulate({recording, maxFrames: 2400, ...})` outcome === 'won'.
   - Pickup stat = 16 / 16.
2. Profile + tune:
   - If below_ground times out, tighten cluster tolerances (try
     0.25 / 2.5 first).
   - If node-cap blows (100k), raise to 200k but assert per-level
     planning time ≤ 10 s.
3. `src/agent/grid.js`:
   - Remove the M4 conservative L-only source gate (`if
     (n.xOffsetBucket !== 'L') continue;`) since the bucket-A* is
     no longer the primary backend; it can return to v26-style
     vxBucket-only (or stay 9-bucket as a diagnostic).
4. `tests/v27-bucket-graph.spec.js`, `tests/v26-bucket-graph.spec.js`:
   - Either tag the existing-level-solves tests with
     `{ planner: 'bucket' }` or relax them to "graph nodes have
     expected shape" only (no end-to-end solve assertion).
5. `npm run build` clean; `npm run build:pages` clean.

**If below_ground STILL doesn't solve at M5**:
- Diagnose: log A*'s open-queue size + the first cell where it
  hits the node cap. Likely a heuristic admissibility or cluster
  tolerance issue.
- Fallback: ship M5 as partial; document in transcript;
  hand off to v29.

```
git commit -m "v28 m5: below_ground solves end-to-end + perf budget"
```

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `TDDs/3_transcripts/version28_build.md` (new): narrative covering:
   - The clustering helpers + tolerances chosen.
   - expandNode's reuse of simAction's simContext (single per-
     plan, not per-A*-expansion).
   - Per-frame A* node count vs bucket-A* on representative
     levels.
   - below_ground's solving path (which row-5 ooos are collected
     in which order; whether multi-solution finds variants).
   - Performance numbers: plan time on each shipped level.
2. Mark design + impl Delivered with the M1–M6 commit-hash table.

```
git commit -m "v28 m6: acceptance + v28 transcript; design + impl Delivered"
```

## Risks & sequencing

- **M3 A* search-space explosion** — per-frame nodes can be huge.
  Mitigation: cluster tolerance gate; 100k-node hard cap.
  Profile in M3; if a level hits the cap without solving, tighten
  tolerance before M4.
- **M3 emit-leg reSim assert fires** — the per-leg replan loop
  from v27 M5 stays in `planner.js`. Under per-frame A* it
  should NEVER trigger (the chain is exact by construction). If
  it does, that's a bug-signal — investigate before M4.
- **M4 TSP × A* cost** — TSP estimates now do per-frame A*. For
  K ≥ 4 pickups, K! × per-leg cost. Mitigation: cap A* depth at
  500 nodes per leg-cost estimate; fall back to Manhattan-only.
- **M4 determinism** — per-frame A* tie-breaking among edges
  with equal cost. Mitigation: tie-break by lexical action name.
- **M4 existing-level regression** — the planner core is
  rewritten. Mitigation: keep `opts.planner = 'bucket'` callable;
  if a level regresses, opt that test back to bucket and
  diagnose. Aim: NO tests pinned to bucket by ship time.
- **M5 below_ground doesn't fully solve** — if per-frame A* hits
  the node cap or a heuristic admissibility issue, M5 ships
  partial. Less likely than v27's failure mode (no bucket
  fragility); more likely a search-space sizing question.
- **No deploy risk** — bundle stays roughly the same: planner
  code grows ~3 KB; bucket-graph code stays. JS net +~3 KB.

## Deferred (design §9 → v29+)

- **Reactive theme listener** (OS-pref flips mid-session).
- **`prefers-color-scheme` first-load default**.
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
