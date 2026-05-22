# Transcript — Version 22: Optimal Plans, Multiple Routes, Restful Legend

A narrative record of the v22 phase. Two parallel threads landed in
one version, sharing no architectural overlap but cohabiting cleanly
in the milestone sequence: agent improvements (M1–M3) shipped first,
then layout polish (M4–M5), then acceptance + transcript (M6).

The brief, captured from the user across two messages mid-build:

> create a v22 design document just focusing on improving the
> testing agent

> add to design and implementation the following isolated feature:
> add a 'fit to screen' button - which zooms the level to as big as
> it can, within the available width/height (maintaining aspect
> ratio) - given the current status of the legend - so, if legend
> minimised, that space on the right can be used for the zoom

The user's earlier wishlist (from `__temp/next_version.md`) added
four legend-layout items: right-side default, minimise/restore
toggle, right ↔ bottom swap, hide-during-Play/Test/Demo. v22 ships
all four plus the fit-to-screen.

The user's go-ahead, verbatim:

> all looks good - go ahead with all milestones, if tests pass at
> each stage

## The shape of the work

Six small commits, one milestone each:

| M | Commit  | Deliverable                                            |
|---|---------|--------------------------------------------------------|
| 1 | `20c5d63` | `src/play/playtestScene.js` — `#spawnFallSettle()` runs up to 30 no-input gravity ticks until `player.onGround === true` BEFORE `simFrame`/`simTime` reset. The recording's input timeline starts AFTER the player has landed. 2 Playwright cases. |
| 2 | `116f149` | `src/agent/planner.js` — `resolveGoals` rewritten with TSP-optimal pickup ordering. K ≤ 4 enumerates all K! permutations (≤ 24); K > 4 uses greedy-nearest seed + 2-opt local search capped at 50 iterations. For `# pickup-required: N of M`, enumerates C(M, N) × N!. +4 unit cases. |
| 3 | `bcdb659` | `src/agent/runner.js` rewritten — returns `solutions: Array<Solution>` (up to 5 unique recordings, sorted ascending by frame cost). Alternatives surface by blocking the longest-cost edge in the current plan and re-planning. `solution = solutions[0]` retained as v20/v21 back-compat alias. `src/agentDialog.js` renders the per-solution list with a focused-row Demo button + open-by-default trace section. |
| 4 | `3817d1c` | `src/main.js` + `src/style.css` — legend defaults to the right (CSS Grid with `grid-template-areas: "status status" "canvas legend"`), `[—]` collapses the body to a thin strip, `[↕]` swaps right ↔ bottom. New `⛶ Fit` toolbar button scales `#preview` to the canvas-wrap area via inline `style.width/height`. All three preferences persist in localStorage. 6 Playwright cases. |
| 5 | `943d865` | `body.testmode` class around `openAgentDialog` joins the existing `playmode` / `demomode` rules: the `.legend` AND the Fit button vanish during all three active modes, the grid track collapses to zero, and `applyFitToScreen()` re-runs so the canvas grows into the freed space. 3 Playwright cases. |
| 6 | _this commit_ | `tests/v22-acceptance.spec.js` — multi-solution-row architecture, above_ground.txt produces ≥ 1 solution row + open trace, click-to-focus on non-focused rows. v22 transcript. Design + impl Delivered. |

Outcome: 284 → 288 unit tests (+4 TSP cases). Playwright 14 → 28
(spawn-settle 2, legend-layout 6, legend-mode-hide 3, v22-acceptance 3).
v9 §7 byte-identical-to-upstream invariant for `src/play/core/*` +
`src/play/entities/*` preserved across all six commits. Bundle:
65.45 → 67.42 kB JS (gzip 23.05 → 23.67 kB), +0.5 kB CSS.

## Thread A — Why the agent reaches farther

### M1 — Spawn-fall settle

The v21 agent built its action-graph assuming the player started at
the **settled** grid cell — the result of `settle()` in `grid.js`.
But the live engine spawns the player mid-air at the P glyph and
they fall. On `tutorial.txt` (P sits 6 rows above its floor) that's
~25 frames of falling BEFORE the recording's first key event. Result:
the recording's "walk-right at frame 1" event fires while the player
is still descending — the walk applies to mid-air physics, not the
grounded plan. Demos went wrong; the agent's plan and the engine's
execution diverged.

The fix is two lines of physics, wrapped in safety:

```js
#spawnFallSettle() {
  if (!this.player) return;
  if (this.player.onGround) return;
  const originalInput = this.game?.input;
  const stub = { isDown: () => false, wasPressed: () => false, endFrame() {} };
  if (this.game) this.game.input = stub;
  try {
    for (let i = 0; i < 30; i++) {
      this.player.update(1 / 60, this);
      if (this.player.onGround) break;
    }
  } finally {
    if (this.game) this.game.input = originalInput;
  }
}
```

Called from `restart()` before `simFrame=0` / `simTime=0`. The stub
input keeps the 30 frames of gravity-only ticks input-free. The 30-
frame cap is conservative — `tutorial.txt`'s 6-row fall settles in
~22 frames; pathological 30+-row falls would resume in the rAF loop
unsettled (no shipped level has that profile).

Visible after M1: pressing Play on a high-spawn level no longer
shows the player visibly drop before the first input — they're
already grounded at game start.

### M2 — TSP-optimal pickup ordering

`tutorial.txt`'s `oooo` row is the classic case. v21's greedy-
nearest planner picks whichever cherry is closest to the spawn
first, then nearest to THAT cherry, etc. — but the cheapest TOTAL
chain is left-to-right, and greedy's first pick is the cherry one
step further from the exit, locking the rest of the chain into a
backtrack.

The new `resolveGoals` enumerates exhaustively when feasible:

```js
function pickBestOrdering(start, goals, options = {}) {
  if (goals.length <= 4) {
    // K! exhaustive — at most 24 permutations for K=4.
    let bestOrder = null;
    let bestCost = Infinity;
    for (const perm of permutations(goals)) {
      const cost = totalChainCost(start, perm, options);
      if (cost < bestCost) { bestCost = cost; bestOrder = perm; }
    }
    return bestOrder;
  }
  // K > 4 — greedy seed + 2-opt local search, capped at 50 iterations.
  const seed = greedyNearest(start, goals, options);
  return twoOptImprove(start, seed, options, 50);
}
```

For `# pickup-required: N of M` (collect N of M optional pickups),
`combinations(M, N)` × `permutations(N)` enumerates the full
solution space. For M=5, N=3: 10 × 6 = 60 candidates — well within
budget.

The +4 unit cases in `planner.test.js` cover: 2-pickup-row optimal,
4-pickup row optimal (the tutorial case), 3-pickup spread, and the
K-of-M required-pickup subset selection.

### M3 — Multi-solution enumeration

The v21 design locked **multi-solution enumeration as v22's
acceptance criterion**. The runner's main loop now keeps planning
until either MAX_SOLUTIONS=5 unique recordings are found or no
further alternatives can be generated. The mechanism for "find
something different" is to block the longest-cost edge in the
current plan and re-plan:

```js
function pickEdgeToBlock(plan, alreadyBlocked) {
  let best = null;
  let bestCost = -1;
  for (const e of plan.trace) {
    if (alreadyBlocked.has(e.edgeId)) continue;
    if (e.cost > bestCost) { bestCost = e.cost; best = e.edgeId; }
  }
  return best;
}
```

Recordings are hashed (the event sequence stringified) to dedupe;
different goal orderings that produce identical recordings collapse
to one. Solutions are sorted ascending by frame cost — solutions[0]
is the shortest.

The dialog (`src/agentDialog.js`) gains a per-solution row layout.
The focused row owns the Demo button; others get a Focus button
that re-paints the path overlay via `onResult({focusedIdx})`. The
trace section auto-opens (`<details open>`) — the v21 click-to-
expand was the wrong default once solutions became plural.

The carry-over: `tutorial.txt` still reports "Exit unreachable from
spawn" even with M1 + M2. The TSP fix gives a correct goal ordering
IF a path exists in the action-graph, but `tutorial.txt`'s spawn
sits one platform-tier above the `oooo` row and the v21 action set
(walk, 12-frame-release jumps, drops) doesn't enumerate the
specific run-off-platform → catch-on-`oooo` trajectory needed to
land precisely on a 1-tile pickup. Documented as a v23 candidate —
"action-graph completeness" needs additional edge types
(`run_off_platform_then_walk_mid_air`, `drop_with_horizontal_carry`).

## Thread B — Why the legend stays out of the way

### M4 — Layout, collapse, swap, and fit

The `.pane.right` becomes a CSS Grid container with two layouts:

```css
.pane.right.layout-right {
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr 220px;
  grid-template-areas: "status status" "canvas legend";
}
.pane.right.layout-bottom {
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr;
  grid-template-areas: "status" "canvas" "legend";
}
```

Collapse is a third class — `.legend-collapsed` — that shrinks the
legend track to `36px` (just enough room for the two toolbar
buttons stacked or side-by-side, depending on layout).

The legend's own innerHTML now leads with:

```html
<div class="legend-toolbar">
  <button class="legend-toggle" data-act="legend-min">— or ▶</button>
  <button class="legend-toggle" data-act="legend-swap">↕</button>
</div>
<div class="legend-body">…glyphs…</div>
```

Three pieces of state, three localStorage keys
(`v22.legendLayout`, `v22.legendCollapsed`, `v22.fitToScreen`),
restored on next load. The initial render calls
`applyLegendLayout()` then `renderLegend()` then
`applyFitToScreen()` — same order as on every subsequent click.

**Fit-to-screen** is a single helper:

```js
function applyFitToScreen() {
  if (editorMode === 'play' || editorMode === 'demo') return;
  if (!fitToScreen) {
    previewCanvas.style.width = previewCanvas.style.height = '';
    return;
  }
  const wrap = document.querySelector('.canvas-wrap');
  const availW = wrap.clientWidth - 24;   // 12px padding × 2
  const availH = wrap.clientHeight - 24;
  if (availW <= 0 || availH <= 0) return;
  const scale = Math.min(availW / previewCanvas.width,
                         availH / previewCanvas.height);
  previewCanvas.style.width  = `${Math.floor(previewCanvas.width  * scale)}px`;
  previewCanvas.style.height = `${Math.floor(previewCanvas.height * scale)}px`;
}
```

`clientWidth` (not `getBoundingClientRect().width`) excludes
scrollbars — that's how the resize loop documented in §10 of the
design is avoided. The function is called from: every legend-
layout click, every `run()` reflow, exit from play, and a 50ms-
debounced `window.resize`. Play/Demo mode early-returns because
v18's CSS pin already owns canvas sizing in those modes.

**TDZ fix landed mid-M4.** The first `applyFitToScreen()` at module
init referenced `editorMode`, which `let`-declared lower in
`main.js` for the play-mode state machine. JavaScript's temporal
dead zone threw "Cannot access 'editorMode' before initialization",
which aborted the rest of `main.js` evaluation — the click handler
never wired up. Fix: hoist `let editorMode = 'edit'` above the
layout state, with a comment pointing back to the full state
machine. Discovered via `page.on('pageerror')` in a debug spec.

### M5 — Out of sight during Play, Demo, and Test

The legend is for authoring. Play, Demo, and the agent's Test
dialog all want screen real-estate. CSS does the heavy lifting:

```css
body.playmode .pane.right > .legend,
body.demomode .pane.right > .legend,
body.testmode .pane.right > .legend { display: none; }
body.playmode .pane.right.layout-right,
body.demomode .pane.right.layout-right,
body.testmode .pane.right.layout-right { grid-template-columns: 1fr 0; }
body.playmode .pane.right.layout-bottom,
body.demomode .pane.right.layout-bottom,
body.testmode .pane.right.layout-bottom { grid-template-rows: auto 1fr 0; }
body.playmode #fitBtn,
body.demomode #fitBtn,
body.testmode #fitBtn { display: none; }
```

Collapsing the grid track to zero (rather than `auto`) lets the
canvas-wrap take the full pane. v18's `body.playmode` / v20's
`body.demomode` classes already existed; v22 adds `body.testmode`
around `openAgentDialog`, removed in the dialog's `onClose`. An
extra `applyFitToScreen()` call on enter/exit re-fits an active fit
mode into the freed (or restored) space.

## Discipline carry-overs that bit (and didn't)

- **Path-scoped `git add`** — the user's `[[scoped-git-add]] memory
  rule, born from a v17 accident, paid off five times in v22: the
  build never staged `__temp/wish_list.md`, `manifest.json`
  modifications, `above_ground2.txt`, `fred.txt`, or any of the new
  Inca / Dirt / Kenney tileset asset drops. Every commit's
  `git status` was reviewed first.

- **v9 §7 byte-identical vendored engine** — `src/play/core/*` and
  `src/play/entities/*` untouched. Only `playtestScene.js` (v9-
  original glue) and `launcher.js` got the M1 settle change. The
  spawn-fall settle works through public Player methods (`update()`
  + `onGround`), not private engine state.

- **One milestone per commit** — six commits, six logical units.
  Each shipped only after `npm test` + `npx playwright test` +
  `npm run build` were all green. M3's commit caught a one-off
  test failure (agent-test-button.spec.js's `trace summary.click()`
  was now closing the auto-opened details element) — fixed in the
  same commit, not papered over.

## What this leaves for v23+

- **`tutorial.txt` solvability** — needs action-graph completeness:
  run-off-platform variants, drop-with-horizontal-carry edges, and
  catch-on-narrow-platform jumps. v22's TSP optimal ordering is a
  prerequisite but not sufficient.
- **`below_ground.txt`** — dies at frame 49 in v21's diagnostic,
  unchanged in v22. Suspected hazard-touch during a spawn-fall.
- **Multi-coloured path overlay** — when the dialog shows ≥ 3
  solutions, render each in a distinct colour simultaneously. v22
  ships focused-one rendering.
- **Author-resizable legend width** — fixed at 220 px in v22.
- **Drag-and-drop legend reorder** — change role-group order.
- **Per-tileset legend persistence** — remember collapsed state per
  tileset, not globally.
- The long-standing v16/v17/v18/v19 carry-overs.

## Closing

v22 lands a multi-solution agent with TSP-optimal pickup ordering
behind a spawn-settled simulator, AND a CSS-Grid legend that knows
when to step aside — under one design document, one implementation
plan, and one continuous test-pass-gate. The two threads didn't
share code, but they shared discipline: small commits, scoped
adds, tested at each gate, byte-identical engine. The user's
`tutorial.txt` ceiling stays as a v23 problem, with the diagnostic
shifted from "exit unreachable" (v21) to "action-graph completeness"
(v22) — a more specific target for next round.
