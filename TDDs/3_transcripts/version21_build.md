# Transcript — Version 21: Agent Solves More Complex Levels

A narrative record of the v21 phase: a focused architectural shift
that lifts the v20 + v20.1 AI level-tester agent's "complex level"
ceiling. v20 shipped an explainable rule-based planner; v20.1
tightened the parabolic envelope and arc validation. Both still
failed on multi-platform / vertical-traversal / jump-precision
levels — including a user-reported "cherry on top of a 3-wide tower"
scenario where v20.1 could collect the cherry but couldn't navigate
back to the exit.

v21's pivot: replace v20's "cell-pair edge" model — where the agent
*hopes* the player lands at a chosen cell — with **action-sequence
edges built by physics simulation**. Each candidate action runs
through the engine ONCE during graph construction; the resulting
landing position becomes the edge. Plans are physically achievable
by construction.

Plus a user-requested UX layer: a **5-second initial budget with a
live countdown timer**; on failure, three escalation buttons offer
**Try 10s / 15s / 20s**.

## The brief

User asked at v21 design time:
> create a v21 design document just to focus on improving the test
> planning agent to be able to solve more complex levels

Then added the countdown / escalation request mid-design:
> extend testing time to 5 seconds initially (and show countdown
> timer to user). If testing fails, offer user options to test for
> 10, 15 or 20 seconds to find a solution (again with countdown
> timers).

The user-reported level that motivated v21's existence (paraphrased
from their bug report):
> the cherry is on top of a 3-wide tower; the player walks left, has
> to jump up onto the tower, collect the cherry, then drop back down
> and walk to the exit on the right. v20.1 collects the cherry but
> can't get back.

## The shape of the work

Six small commits, one milestone each, in dependency order:

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `bcb4e8b` | `src/agent/actions.js` — taxonomy (`walk{dir,cells}` / `jump{dir,holdFrames}` / `drop{dir}` / `wait{frames}`) + `enumerateActions` + `actionToRecording` + `actionToWhy`. 28 candidate actions per cell (2 walks + 24 jumps × 12 release-frames × 2 dirs + 2 drops). 18 unit tests. |
| 2 | `3cd338d` | `src/play/playtestScene.js` gains `setPlayerState({x,y,vx,vy,onGround})` (v9-original glue — vendored engine untouched). New `src/agent/simAction.js` runs one action from a forced start state, returns `{outcome, endPos, endCell, endVel, collided, cost}`. 8 unit tests including release-mid-arc proof + sub-pixel start position preservation. |
| 3 | `334e640` | `src/agent/grid.js` rewritten. `buildNavGraph` enumerates ~28 actions per grounded cell, runs `simulateActionInContext` for each (one reusable `PlaytestScene` across all sims), keeps edges that end cleanly on a grounded walkable cell. Win edges (where the action's parabola overlaps an exit AABB mid-flight) redirect to the actual exit cell. |
| 4 | `8cba94b` | `src/agent/runner.js` rewritten as `async`. `opts.maxRuntimeMs` (default 5000) is the primary cap; `onProgress(elapsedMs, totalMs)` callback for UI countdown; `opts.signal` (AbortController) for Esc/cancel. `planner.js` threads `tileset` through `opts`. |
| 5 | `4bf6388` | UI: `src/agentDialog.js` rewritten with three states (searching / success / failure). Live countdown `<output>` + `<progress>` bar. Failure dialog offers `[Try 10s] [Try 15s] [Try 20s]`. `src/agent/overlay.js` renders jump entries as parabolic-arc Bezier curves. **PlaytestScene's `#tickScriptedInput(dt)` ties input advance to wall-clock time** (not browser-tick count) — fixes a headless-120fps timing bug that broke live demos. |
| 6 | _this commit_ | `tests/agent-test-button.spec.js` +4 cases (countdown visible, escalation buttons, tower-cherry solves, above_ground solves). v21 transcript. Design + impl Delivered. |

Outcome: 257 → 284 unit tests (+27: actions 18, simAction 8, +1 free from refactor). Playwright 6 → 8 (the v21 agent e2e suite). Both builds clean throughout. v9 §7 byte-identical invariant for `src/play/core/*` + `src/play/entities/*` preserved across all six commits.

## The architectural pivot — edges by simulation

The crux of v21 in two sentences:

> **v20:** the planner picks `(cellA, cellB)` and emits a recording
> assuming the player lands at cellB. Physics often disagrees.
>
> **v21:** the planner picks `(cellA, action)`; the simulator tells
> the planner where the player actually lands; that's the edge.

Concretely, the graph builder (`src/agent/grid.js`) iterates each
grounded cell and calls `enumerateActions()` for ~28 candidates. For
each, `simulateActionInContext(ctx, startState, action)` mints — or
reuses — a `PlaytestScene`, forces the player to the start state via
`setPlayerState`, plays the action's recording through one
`scene.update` per simulated frame, and returns the resulting
position + velocity + collision flags.

Reusing one `PlaytestScene` across all sims (via the M3
`makeSimContext` factory) is the perf-critical detail. A naive "new
scene per action" approach would pay `PlaytestScene` + `toWorld()`
construction cost ~30 × ~200 = ~6000 times per `buildNavGraph` call.
The reuse path resets only the volatile state (phase, score, coins'
`collected` flag, player position) between sims.

## The release-direction-mid-jump unlock

The user's tower-cherry level was the v21 acceptance target. v20.1
couldn't solve it because the jump from (9, 11) to (6, 5) (3 cells
up, 6 cells left) requires the player to **release the left key
mid-jump** so they land precisely on the tower top instead of
overshooting it.

v20's jump action: press space + hold direction for the full arc
(~42 frames). One option per `(cell, direction)` pair. No way to
"land short".

v21's jump action: `{ dir, holdFrames }`. The taxonomy enumerates
12 release-frame choices: `{2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42}`.
Per cell, that's 24 jump variants × 2 walks × 2 drops = 28 actions.
A* picks whichever variant lands where the goal expects.

For the tower-cherry level, the agent picks
`jump_left_holdFrames=26` (or similar — the planner doesn't care
which specific frame, only that the resulting endCell matches the
plan).

## The wall-clock timing fix

A subtle bug surfaced once the M5 dialog could observe the demo
running. v20 fed `ScriptedInput.advance(frame)` from a **parallel
`requestAnimationFrame`** in the launcher. v21 (M5) moved
`advance()` INSIDE `PlaytestScene.update()` via a new
`#tickScriptedInput(dt)` method so the input updates synchronously
before `player.update` reads it.

That fixed the rAF race. But it surfaced a second issue: **headless
Chrome ran rAF at 120fps in Playwright tests**. With one
`scene.update` per browser frame and one `input.advance` per
`scene.update`, the input timeline advanced TWICE as fast as
physics expected. Recordings authored at 60fps (the simAction's `dt`
basis) released the direction key well before the player reached
the target.

The fix: tie `input.advance` to wall-clock `simTime`, not browser-
tick count:

```js
this.simTime += dt;
const target = Math.floor(this.simTime * 60);
while (this.simFrame < target) {
  input.advance(this.simFrame++);
}
```

At any browser refresh rate (60 / 120 / variable), `input.advance`
fires at exactly 60Hz wall-clock. `simAction`'s `dt=1/60` model is
a special case — `target` increments by 1 each loop iteration, one
advance per iteration. Live engine at 120fps: `target` increments
by 0.5 per tick, advance fires every other tick.

This also required resetting BOTH `simFrame` AND `simTime` between
`simulateActionInContext` calls — without resetting the
accumulator, the second action's first update would burn through
the entire recording in one tick.

## The countdown + escalation UX

The dialog is now a state machine:

```
[Test clicked]
       ↓
   searching ←──┐
       │        │
       ↓        │
     ┌─┴──┐    │
   ok      fail
       │        ↑
       │     [Try 10s/15s/20s clicked]
       ↓
    success
       │
       ↓
    [Demo clicked]
       │
       ↓
   (demo plays)
```

The dialog opens IMMEDIATELY when `[Test]` is clicked (no setTimeout
delay). The searching state renders a big monospace `<output>`
counting down from 5.0s (driven by an internal rAF ticker reading
`Date.now()`), and a `<progress>` bar from 0 to maxBudget. The
agent runs asynchronously, yielding via `await new Promise(r =>
setTimeout(r, 0))` between attempts so the countdown can repaint.

On success: dialog transitions to the v20 success state (badge +
stats + Demo + trace).

On failure: dialog renders three escalation buttons in a
horizontal row. Each click re-invokes `runAgent(N*1000)` and
transitions the dialog BACK to searching state with the new
budget. The 5s → 10s → 15s → 20s ramp covers the levels that need
multiple goal-ordering tries; if 20s isn't enough, the dialog
shows only the Close button (no infinite escalation).

Esc, backdrop click, and Cancel all funnel through one path:
`abortController.abort()`. The runner's `yieldTick` sees
`signal.aborted` on the next yield and bails.

## Curved arcs in the overlay

`src/agent/overlay.js` now renders jump trace entries as
parabolic-arc Bezier curves (6-point quadratic Bezier with peak ≈
1 tile above the higher endpoint). Walk + drop entries stay as
straight segments. Numbered markers (S at spawn, 1/2/3 at pickups
in visit order, E at exit) unchanged.

Visually: the path-overlay polyline now reads naturally — long
horizontal walks are straight lines; jumps arc up and over;
multi-pickup levels show distinct "loops" as the agent visits each.

## Hiccups along the way

**M2 wall-collision detector false positive**: the first version
checked pre-update `vx`. At dir-release frames, pre-update vx was
nonzero from the previous frame, the post-update x didn't move
(because vx just became 0), so it flagged "collided". Fix: check
POST-update vx — if vx is nonzero AND x didn't move, that's a
real wall collision.

**M2 test level too cramped**: the original M2 test level was
3 rows tall with `#` at row 0 (ceiling immediately above the
player). Jump tests gave identical results for `holdFrames=2` and
`holdFrames=42` — because both immediately hit the ceiling. Fixed
by giving the test level 2 rows of sky for jump headroom.

**M3 walk cost was 35, not 5**: simAction was running `maxFrames =
nominalCost + 30` iterations regardless of when the walk's release
event fired. Cost reported = loop iteration count. Fix: walks run
`nominalCost + 1` iterations (one extra to process the release);
cost = nominalCost.

**M3 self-loop filter dropped win edges**: walking 1 cell from
col 2 lets the player overlap the exit at col 3 (since their AABB
extends right past col 3's left edge). simAction returned
`outcome='won'` with `endPos.x = 44` — AABB centre at (54, 30),
center cell still (1, 2). Self-loop check then dropped the edge.
Fix: when outcome is 'won', find the overlapping exit cell and
redirect the edge there + skip the self-loop check.

**M3 off-by-one in cost**: simAction's loop frame N had executed
(N+1) physics updates (including the pre-settle). Live engine's
"N frames after press" had executed N updates. simAction reported
cost=N but live engine needed cost=N+1 motion frames to reach the
same state. Fix: report `frame + 1` on early returns.

**M5 input rAF race**: v20's parallel-rAF input ticker raced with
the engine's tick in headless Chrome. Moved `advance()` inside
`PlaytestScene.update()` (via `#tickScriptedInput`).

**M5 120fps headless Chrome**: the move-into-update fixed the
race but exposed that browser rAF ran at 120fps in headless mode.
Tied input.advance to wall-clock `simTime`.

**M5 simTime accumulation across action sims**: reusing a
`PlaytestScene` across 28+ action simulations meant `simTime`
kept accumulating. Second sim's first update would advance
through the entire recording in one tick. Fix: reset BOTH
`simFrame` AND `simTime` in `simulateActionInContext`.

## What v21 solves (and what it doesn't)

Acceptance results, measured on the live deploy:

| Level | v20.1 | v21 |
|---|---|---|
| `simple.txt` (flat walk) | ✓ 22 walks, 6 frames | ✓ 11 steps, 106 frames |
| **user's tower-cherry** | ✗ no solution (cherry collected, exit unreached) | ✓ **16 steps · 1 jump · 1 pickup · 20 ms** |
| **`above_ground.txt`** | ✗ timeout | ✓ **10 steps · 3 jumps · 5 pickups · 45 ms** |
| `tutorial.txt` | ✗ timeout | ✗ dead (still fails) |
| `below_ground.txt` | ✗ dead | ✗ dead (still fails) |
| unreachable-void test | ✓ correctly reports "exit unreachable" | ✓ same |

**v21 solves the user's reported tower-cherry level** in 20ms — the
core acceptance criterion of the version.

**v21 also solves `above_ground.txt`** end-to-end (3 jumps and
all 5 pickups), which v20.1 couldn't.

**`tutorial.txt` and `below_ground.txt` still fail** — they
require either:
- TSP-optimal pickup ordering (tutorial's `oooo` row needs all
  4 in a chain; greedy nearest-first picks wrong),
- Multi-platform vertical traversal beyond the agent's current
  goal-ordering heuristic, or
- Backtracking around walls (collect-key-then-return-style).

These are explicit v22+ carry-forwards. v21 makes the action-graph
foundation that v22 will build TSP + multi-solution + smarter
backtracking on top of.

## What stayed out (v22+ candidates carried forward)

The v21 design's §9 "Deferred" list, refined by v21's results:

- **Multi-solution enumeration** — locked v22 acceptance criterion.
  The action-graph makes Yen's K-shortest-paths a clean drop-in.
- **TSP-optimal pickup ordering** — would solve `tutorial.txt`.
  Combine with multi-solution.
- **Smarter goal-ordering heuristics** — beyond greedy nearest.
- **Learning physics empirically** — probe at startup instead of
  reading constants.js.
- **Backtracking around walls** (collect-key-then-return).
- **Author-difficulty rating** — composite from `{steps, jumps,
  releases, replans, deaths}`.
- **Web Worker for big-world graph build** — only if perceived
  performance demands it.
- **Multi-level cross-agent** (with future doors / tunnels).
- **Animated decoration physics** — agent treats them as inert.

Plus the v16/v17/v18/v19/v20 long-standing carry-overs (camera
damping, parallax, decoration-image placement, layered z-order,
per-cell animation phase, multi-row atlases, state-changing exit,
the v17 dead-end `caretLineCol` helper cleanup).

## The standing gap

Unchanged from v13–v20 — no automated DOM-mutation test of the
broader interactive surface beyond Playwright. v21 grew the unit
suite from 257 to 284 (+27 across the four new agent modules).
Playwright went 6 → 8 — the new agent-test-button cases verify
the countdown is visible, the escalation buttons appear on
failure, the tower-cherry level solves, and `above_ground.txt`
solves.

The honest limit: **v21 doesn't solve every level**. The
acceptance criteria of "tutorial.txt solves" remains unmet (it
needs smarter goal ordering than greedy nearest). The user's
specific reported tower-cherry level — the explicit motivating
case — solves cleanly. That's the win that justifies v21.
