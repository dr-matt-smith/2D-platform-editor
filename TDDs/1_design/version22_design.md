# 2D Level Designer — Version 22 Design Document

Status: **Delivered (2026-05-22)** · Builds on:
[version21_design.md](version21_design.md) (action-graph agent +
countdown UX) · Implementation:
[version22_implementation.md](../2_implementation/version22_implementation.md)
· Transcript:
[version22_build.md](../3_transcripts/version22_build.md)

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `20c5d63` | PlaytestScene spawn-fall settle (no-input gravity until onGround) |
| 2 | `116f149` | TSP-optimal pickup ordering (K!≤4 exhaustive + 2-opt) |
| 3 | `bcdb659` | Multi-solution enumeration (up to 5 unique, sorted by cost) + dialog list UI |
| 4 | `3817d1c` | Legend layout (right default, min/max, swap) + fit-to-screen |
| 5 | `943d865` | Hide legend (and Fit button) in Play / Demo / Test modes |
| 6 | _this commit_ | v22 acceptance e2e + transcript; design + impl Delivered |

Tests: 288 unit / 28 Playwright pass. Bundle: 67.42 kB JS (gzip 23.67 kB).
v9 §7 byte-identical engine invariant preserved across all six commits.

Carry-over to v23: `tutorial.txt` still fails at "Exit unreachable"
— diagnostic now points at action-graph completeness (missing
run-off-platform and drop-with-horizontal-carry variants), with the
TSP-optimal ordering already in place as a prerequisite.

## 1. Purpose

A coherent bundle of two parallel threads:

### Thread A — More-capable testing agent

v21's action-graph + release-mid-jump unlocked the user's tower-
cherry level and `above_ground.txt`, but `tutorial.txt` and
`below_ground.txt` still fail. v22 closes that gap with three
focused improvements:

1. **Spawn-fall settle** — the agent's plan assumes the player
   starts at the *settled* cell, but the live engine spawns the
   player mid-air at the P glyph and they fall. For levels where
   P is more than 1 row above its support (`tutorial.txt`'s 6-row
   fall), the recording's input events fire while the player is
   still descending. v22 makes the launcher settle the player
   BEFORE the input timeline begins.

2. **TSP-optimal pickup ordering** — v21's greedy nearest-first
   ordering fails on `tutorial.txt`'s `oooo` row (the optimal
   path visits col 8 → col 11, but greedy picks the wrong one
   first). v22 enumerates all K! permutations for K ≤ 7 (and
   uses a heuristic for K > 7), within the time budget.

3. **Multi-solution enumeration** — the v20/v21 carry-forward
   locked-in v22 criterion. The dialog now lists up to **5
   distinct solutions** (different goal orderings × different
   jump-release timings), each with its own `[Demo]` button and
   path-overlay colour.

### Thread B — Legend layout polish + fit-to-screen

Per the user's wishlist:

1. **Legend defaults to the RIGHT side** of the editor canvas.
   (Currently below the canvas.)
2. **Minimise / restore toggle** on the legend (collapses to a
   thin strip; click to expand again).
3. **Right ↔ Bottom toggle** — author can swap the legend's
   position between right-side and bottom-of-screen.
4. **Hide legend in Play / Test / Demo modes** — the legend is
   for authoring; during playtest or agent-demo it's irrelevant.
   v18's `.edit-only` class infrastructure already covers Play
   mode; v22 extends to Test (the agent dialog) and Demo.
5. **Fit-to-screen zoom button** — toggles a mode that resizes
   the `#preview` canvas via CSS to fill the available
   canvas-wrap area (width × height) while preserving the
   level's aspect ratio. Reacts to legend state: minimising the
   legend or swapping it to the bottom REVEALS more area, and
   the canvas re-fits automatically. Off-mode = natural intrinsic
   sizing (today's behaviour).

## 2. Current state

### Agent (v21):

- Builds action-graph by simulation (~28 actions per grounded cell).
- Plans via A* with greedy nearest-first pickup ordering.
- Single-solution output.
- Player spawns mid-air at the P glyph; `Player.onGround = false`
  initially. The first ~25 frames are spent falling on multi-row
  spawns; agent's recording starts at frame 1 assuming the player
  is settled.
- `tutorial.txt` reports "Exit unreachable from spawn" — A* can't
  find a path even though one exists via the stepping-stone
  platforms. Multiple causes suspected: spawn-fall drift, missing
  jump variants, or A* state-space pruning too aggressive.
- `below_ground.txt` dies at frame 49 — a hazard-touch during a
  spawn-fall or an early walk.

### Layout (v21):

- Editor canvas in `.pane.right` (full width).
- Legend below the canvas (`.legend` div).
- Toolbar above the canvas.
- Problems bar at the very bottom (single-line, v17).
- Legend is always visible regardless of editor mode.

## 3. Architecture

### 3.1  Spawn-fall settle

Two changes:

- **`PlaytestScene.restart()`**: after `toWorld()` creates the player,
  manually settle them by running gravity-only physics until
  `player.onGround === true` OR a frame budget is exhausted. No
  input applied during settle. `simFrame` + `simTime` start at 0
  AFTER the settle.

- **`src/agent/grid.js` start cell**: already uses `settle()` to
  find the P-settled cell. No change needed — the agent and the
  live engine agree on the settled position.

The settle is at most ~30 frames at 60fps (= 500ms of falling). In
the live engine, this happens BEFORE `game.start()`'s rAF loop
begins, so the user sees the player drop briefly then start
demoing.

### 3.2  TSP-optimal pickup ordering

`src/agent/planner.js`'s `resolveGoals` rewritten:

- **K ≤ 7**: enumerate all K! orderings (≤ 5040 for K=7). For
  each, compute the total A* cost across the chain. Pick the
  minimum.
- **K > 7**: fall back to greedy nearest-first (v21 behaviour)
  with **2-opt local search** if time permits — swap pairs of
  visits, keep the swap if it lowers cost.
- **Required-pickup subset selection** (when `# pickup-required:
  N of M`): for each combination of N pickups out of M, compute
  the best ordering. Combinations × orderings = C(M, N) × N!.
  For M=5, N=3: 10 × 6 = 60. Tractable.

### 3.3  Multi-solution enumeration

`src/agent/runner.js`'s `testLevel` returns a list of solutions
sorted by total cost (frames):

```js
{ ok: true, solutions: [ {plan, recording, stats}, ... ], ... }
```

(The v21 single-solution shape `{ ok: true, solution: {...} }` is
preserved for back-compat — `result.solution = result.solutions[0]`.)

Enumeration strategy: for each top-K goal ordering, run A*; if
the result is a NEW recording (not already in the list), add it.
Cap at K=5 within the user-budget time.

### 3.4  Legend layout

`src/style.css` gains a `.legend.layout-right` (and existing
`.legend.layout-bottom` as the default-equivalent) class. The
layout-right variant uses CSS grid or absolute positioning to
park the legend on the right side of the canvas-wrap. Width
configurable (~200px).

`src/main.js` adds a small legend-layout state machine:

```js
let legendLayout = 'right'; // 'right' | 'bottom'
let legendCollapsed = false;
```

Persisted to `localStorage` so the author's preference survives
reloads.

Two new buttons rendered above the legend:

- **Minimise / Restore**: `[—]` toggles collapsed; collapsed
  legend shows just the role icons (no text). Re-expand on click.
- **Right ↔ Bottom**: a small layout-swap button. Cycles
  between the two layouts.

### 3.5  Fit-to-screen zoom

`src/main.js` adds a `fitToScreen` state flag (persisted in
localStorage, default `false` on first load) and a helper:

```js
function applyFitToScreen() {
  if (!fitToScreen) {
    previewCanvas.style.width = '';
    previewCanvas.style.height = '';
    return;
  }
  // Available area = canvas-wrap dims minus padding.
  const wrap = document.querySelector('.canvas-wrap');
  const availW = wrap.clientWidth - 24;  // 12px padding × 2
  const availH = wrap.clientHeight - 24;
  // Canvas intrinsic dims (from current parsed level).
  const intrinsicW = previewCanvas.width;
  const intrinsicH = previewCanvas.height;
  const scale = Math.min(availW / intrinsicW, availH / intrinsicH);
  previewCanvas.style.width  = `${intrinsicW * scale}px`;
  previewCanvas.style.height = `${intrinsicH * scale}px`;
}
```

The function is called from:
- `[fit]` button click (toggles `fitToScreen`).
- `setLegendLayout()` (legend right ↔ bottom changes the
  wrap dims).
- `setLegendCollapsed()` (collapsing reclaims ~170 px of width).
- `run()` after each reflow (level resize → new intrinsic dims).
- A debounced `window.resize` listener.

In Play / Test / Demo modes the existing CSS-pin from v18
(`previewCanvas.style.width = (viewport.w ?? gridW) * TILE`)
takes over; fit-to-screen sets inline width which would
conflict, so `tryPlaytest()` clears the fit-mode inline style
on entry and `exitPlaytest()` restores it.

`image-rendering: pixelated` (set in v18's CSS) keeps the
upscaled rendering crisp.

### 3.6  Hide legend in play/test/demo

- v18's `.edit-only` CSS class covers Play mode (`body.playmode
  .edit-only { display: none; }`).
- v22 adds the legend to that class (or a sibling `.legend` with
  the same gate).
- v20+ Demo mode uses `body.demomode` — extends to hide the legend.
- v21+ Test (agent) opens a MODAL dialog over the editor; the
  legend doesn't need to hide structurally, but the modal-backdrop
  obscures it. No change needed unless we want it ALSO hidden
  semantically (proposed: hide via a `body.testmode` class added
  when the agent dialog opens, removed when it closes).

## 4. UX in detail

### 4.1  Right-side legend (default)

```
┌─────────────────────────────────────────────┐
│ toolbar                                     │
├─────────────────────────────┬───────────────┤
│                             │ LEGEND  [—] [↕]│
│                             │ ─────────────│
│         canvas              │ TERRAIN       │
│                             │ ▢ Filled      │
│                             │               │
│                             │ PLAYER        │
│                             │ ▢ Pea         │
│                             │               │
│                             │ ...           │
├─────────────────────────────┴───────────────┤
│ problems bar (status messages)              │
└─────────────────────────────────────────────┘
```

The `[—]` button collapses the legend to a thin vertical strip
of icons; `[↕]` swaps to bottom layout.

### 4.2  Bottom legend (swap option)

The v17/v21 default — legend below the canvas, role groups in a
horizontal row.

### 4.3  Fit-to-screen button

A small `[⛶]` button (or `[Fit]`) in the toolbar — proposed
position: next to `[Play Settings]` / `[Test]`, since it's an
editor-mode utility. Click toggles fit-mode on/off. The
button reflects state (filled icon when on, outline when off).

When fit-mode is ON:
- Canvas scales to fill the visible wrap area.
- Legend changes (minimise / restore / swap) trigger a re-fit
  automatically — the user doesn't need to re-click [Fit].
- Window resize triggers a debounced re-fit.

When fit-mode is OFF:
- Canvas displays at its intrinsic size (gridW × editorTILE),
  clipped by `max-width: 100%` when the wrap is narrower.

The persisted choice survives reloads.

### 4.4  Test/Demo mode hides the legend

The agent's `[Test]` flow opens a modal dialog. The legend can
be hidden (via `body.testmode` class) so the visible area below
the dialog is uncluttered. Optional v22; defaults to "leave
visible" if implementation cost is non-trivial.

For Demo mode (recording playback), the legend hides via the
existing `body.demomode` rule.

### 4.5  Multi-solution dialog

The agent dialog's success state extends to render a list:

```
✓ Level completable — 3 solutions found

Solution 1 — 16 steps · 1 jump · 1 pickup           [Demo this route]
Solution 2 — 18 steps · 2 jumps · 1 pickup          [Demo this route]
Solution 3 — 22 steps · 0 jumps · 1 pickup          [Demo this route]

▾ Trace (Solution 1, 16 actions)
  1–6  walk left toward pickup #1 at (5,6)
  ...
```

The trace section shows the FOCUSED solution's trace (click a
solution row to focus). Path overlay re-renders for the focused
solution; multiple solutions could be rendered in different
colours via a "show all" checkbox (v23 candidate; v22 ships
focused-one rendering).

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/play/playtestScene.js` | `restart()` settles the player via no-input gravity ticks (up to 30 frames) until `onGround=true`; `simFrame` + `simTime` reset to 0 AFTER the settle |
| `src/agent/planner.js` | `resolveGoals` rewritten: K!-exhaustive for K≤7, 2-opt heuristic for K>7. Returns a list of orderings ranked by total A* cost |
| `src/agent/runner.js` | Returns `solutions: []` array (up to 5); `result.solution = solutions[0]` for back-compat |
| `src/agentDialog.js` | Multi-solution list renderer; each solution row has Demo + focus-trace |
| `src/agent/overlay.js` | Focused-solution overlay path (single colour for v22; multi-colour as v23 candidate) |
| `src/main.js` | Legend layout state machine (right/bottom + collapsed); body classes for test/demo modes; **fit-to-screen toggle + applyFitToScreen() helper called from legend changes + window resize + level reflow** |
| `src/style.css` | `.legend.layout-right` + `.legend.layout-bottom` + `.legend.collapsed` rules; `body.testmode .legend { display: none; }` etc.; **`#fitBtn` toolbar styling (matches existing toolbar buttons)** |
| `tests/agent-test-button.spec.js` | New cases: tutorial.txt now solves (1 case); multi-solution list shown (1 case); legend layout toggles persist (2 cases) |
| `tests/legend-layout.spec.js` (new) | dedicated layout suite |

## 6. Open questions — proposed defaults

- **Spawn-fall settle vs first-recording-frame offset**: proposed
  settle in restart() (PlaytestScene-side fix). Alternative: the
  planner offsets the recording by the fall duration. Settle is
  simpler + works for all spawn positions.
- **TSP threshold K ≤ 7**: 7! = 5040 orderings, each ~50ms A* run
  = 4 minutes. Too slow within 5s budget. **Proposed**: K ≤ 4
  exhaustive (24 orderings ≤ 1.2s), K > 4 use 2-opt. Or: only
  enumerate top-N by greedy nearest within budget.
- **Multi-solution K = 5**: proposed cap. The dialog list is
  scrollable so K can grow if performance allows.
- **Legend default position**: per user request, RIGHT side.
- **Legend min/max state persistence**: `localStorage` —
  survives reloads.
- **Legend right-side width**: ~200px. Author-resizable as v23
  candidate.
- **Hide legend in Test mode**: proposed YES — but the modal
  backdrop already obscures it visually, so it's a polish item.
  Optional within v22; sliced as separate M5 milestone so it can
  be dropped if time-tight.

## 7. Acceptance criteria

### Agent
- **`tutorial.txt` solves** — the agent visits the `oooo` row
  in left-to-right order (pickup #1 = col 8, #2 = col 9, #3 = col
  10, #4 = col 11), then reaches the exit. Trace shows at least
  one `jump_release_at_M` action.
- **`below_ground.txt` solves** — the agent navigates the
  hazards and reaches the exit. (May need additional planner
  work; if not feasible in v22 scope, becomes a documented v23
  candidate.)
- **`above_ground.txt`, simple.txt, tower-cherry continue to
  solve** — no regression.
- **Multi-solution**: levels with K ≥ 2 pickups show 2+
  solutions in the dialog (different orderings).
- **Demo from each solution** replays cleanly to win.

### Layout
- **Legend defaults to right side** on first load (no
  localStorage entry).
- **`[—]` button collapses** the legend; **second click expands**.
- **Layout-swap button** toggles right ↔ bottom; the choice
  persists.
- **Legend hidden in Play / Demo mode** (v22 extends existing
  v18 `.edit-only` gate).
- **Optional**: legend hidden in Test mode while the agent
  dialog is open.
- **Fit-to-screen toggle**: clicking `[⛶]` scales the canvas
  to fill the wrap area (preserving aspect ratio).
  Minimising/swapping the legend grows the wrap and the
  canvas re-fits automatically.

### Tests
- `npm test` green; `npx playwright test` green (existing 14 +
  ≥ 4 new cases).

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Tileset schema** — unchanged.
- **The vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **The v17 single-line problems bar / hidden text pane / toolbar
  layout** — unchanged (toolbar is the same; problems bar
  unchanged).
- **The v20/v21 Demo replay mechanism** — unchanged; multi-
  solution adds Demo buttons per row, but each uses the same
  recording → ScriptedInput path.
- **The countdown timer + escalation buttons** (v21 M5) —
  unchanged; multi-solution result still arrives at end of
  countdown, just with more solutions inside.

## 9. v23+ candidates / deferred

- **Multi-coloured overlay rendering** — when 3+ solutions are
  in the dialog, render each in a different colour on the
  overlay simultaneously. v22 ships focused-one only.
- **Backtracking around walls** (collect-key-then-return) —
  long-standing.
- **Author-difficulty rating** — composite from solution stats.
- **Web Worker for big-world graph build** — perceived-perf
  candidate.
- **Multi-level cross-agent** (with future doors / tunnels).
- **Author-resizable legend width** on right-side layout.
- **Drag-and-drop legend reorder** — change role order.
- **Per-tileset legend customisation persistence** —
  remember collapsed state per tileset.
- **Fit-to-screen sub-modes** (`cover` / `contain` /
  `fill`) — v22 ships the `contain` behaviour
  (preserves aspect ratio + leaves padding); future
  versions could let the author choose.

Plus the long-standing v16/v17/v18/v19 carry-overs (camera damping,
parallax, decoration-image placement, layered z-order, per-cell
animation phase, multi-row atlases, state-changing exit, the v17
dead-end `caretLineCol` helper cleanup).

## 10. Risks

- **Spawn-fall settle blocking game.start()**: settle runs ~30
  frames synchronously before the rAF loop. If a level has
  pathological gravity (e.g. terminal velocity beyond the budget)
  the settle could exceed its frame budget. Mitigation: cap at
  30 frames; if not settled by then, start the loop anyway
  (player will continue falling at game start).
- **TSP combinatorial blow-up**: K=7 is the practical limit
  (5040 perms). K=8 = 40320. Mitigation: tiered approach (full
  enumerate K≤4, 2-opt K>4) keeps the budget under control.
- **Multi-solution duplicate filtering**: different goal
  orderings can produce identical recordings (e.g., if the
  optimal path visits all pickups in the same order regardless
  of which is "first"). Mitigation: hash recordings; only add
  unique recordings to the list.
- **Legend layout shifting causes content reflow**: changing
  position from right to bottom mid-session might cause the
  canvas to resize unexpectedly. Mitigation: the canvas uses
  the same `flex: 1` rule; layout-swap repaints via existing
  `reflow()`.
- **localStorage availability**: tests run in headless mode
  with disabled localStorage (`page.context().clearCookies()`
  etc.). Mitigation: fall back to default-right if
  localStorage throws.
- **Fit-to-screen resize-loop**: if the canvas's CSS dims change
  in response to a resize event, the wrap's dims could shift
  (scrollbar appears), triggering another resize, infinite loop.
  Mitigation: debounce the resize listener (50 ms) AND use the
  WRAP's `clientWidth/Height` (which exclude scrollbars) — not
  `getBoundingClientRect()`.
- **Fit-to-screen vs Play mode CSS-pin**: v18's hotfix pinned
  the canvas display width during Play mode. Fit-mode also
  sets inline width. `tryPlaytest()` clears fit-mode's inline
  style on entry; `exitPlaytest()` re-applies fit-mode.
- **No deploy risk** — bundle grows by ~3-5KB (planner TSP +
  multi-solution + dialog list renderer + layout CSS +
  fit-to-screen helper).

## 11. Why this scope

The user's two threads — agent improvements and legend layout —
are independent feature areas that share no architectural
overlap. Bundling them into v22 keeps the version count manageable
(would otherwise need a v22-agent + v22-layout) and lets the
milestone sequence interleave them: agent M1-M3 land first
(unblocking acceptance), then layout M4-M5 land as a polish layer.

The v21 transcript explicitly locked **multi-solution
enumeration as v22's acceptance criterion**; v22 delivers that
plus the TSP-optimal ordering needed for `tutorial.txt`. The
spawn-fall settle is the third agent thread, added because v21's
acceptance criteria identified it as a latent issue.
