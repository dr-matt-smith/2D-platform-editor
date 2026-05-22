# Version 22 — Implementation Plan

Status: Proposed · Date: 2026-05-22 · Design:
[../1_design/version22_design.md](../1_design/version22_design.md)

Six small path-scoped commits. The two threads — agent improvements
(M1–M3) and legend layout (M4–M5) — interleave cleanly: agent work
lands first (unblocking acceptance criteria for `tutorial.txt`),
then layout work lands as a polish layer, then docs.

## Process (same discipline as v8–v21)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/` files stay out.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  vendored files is preserved.** v22 only touches v9-original glue
  (`playtestScene.js`, `launcher.js`) and sibling editor / agent
  modules.

## Constraints & approach

- **Back-compat is the gate** at every milestone:
  - The agent's public entry `testLevel(parsed, legend, tileset)`
    return shape changes ADDITIVELY: `result.solutions` is a new
    field; `result.solution` continues to be `solutions[0]` for
    v20/v21 callers.
  - The legend's default position changes from "below" to "right"
    — a visible UI change, but the role-group structure and glyph
    buttons within the legend stay identical. localStorage
    preserves the user's choice across sessions.
  - All v18–v21 keyboard shortcuts and toolbar buttons unchanged.
- **The spawn-fall settle is the riskiest agent change** — it
  modifies PlaytestScene's restart() in a way that affects BOTH
  the agent's simAction context AND the live game. Mitigation:
  the settle is gated on the player NOT already being onGround
  AND a frame budget (max 30 ticks).
- **TSP-optimal scope-cap: K ≤ 4 exhaustive (24 perms ≤ 1.2s)**,
  K > 4 fall back to 2-opt local search. This keeps the search
  within the 5s primary budget on the default tilesets.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/play/playtestScene.js` | `restart()` runs a no-input settle loop until `player.onGround === true` (max 30 ticks) BEFORE resetting `simFrame`/`simTime`. Affects both live engine and agent's simAction context | M1 |
| `src/agent/simAction.js` | No code change — context.scene.restart() now incorporates the settle | M1 |
| `tests/spawn-settle.spec.js` (new) | Asserts that a level with a high spawn (P 6 rows above floor) reaches a winning solution in the agent (vs v21's "Exit unreachable") | M1 |
| `src/agent/planner.js` | `resolveGoals` rewritten: enumerate K! orderings for K ≤ 4 (exhaustive), 2-opt local search for K > 4. Pick min-cost ordering. Returns the goal queue. For pickup-required = K of M, enumerates C(M, K) × K! within budget | M2 |
| `src/agent/planner.test.js` | New cases: tutorial-like level with 4-pickup chain solves; 2-opt swap demonstrably lowers cost on a contrived 5-pickup level | M2 |
| `src/agent/runner.js` | Returns `solutions: [...]` array (up to 5 unique recordings) sorted by cost. `solution = solutions[0]` retained for back-compat | M3 |
| `src/agent/runner.test.js` | New cases: a level with multiple valid orderings returns ≥ 2 solutions; duplicate recordings filtered | M3 |
| `src/agentDialog.js` | Success state renders the solutions list (each row: stats + Demo button). Clicking a row focuses it (shown trace + overlay re-paint). First row is focused by default | M3 |
| `src/agent/overlay.js` | `renderSolutionOverlay` accepts a solution-index parameter (defaults to 0 = focused). Multi-colour rendering is a v23 candidate; v22 renders the focused-one only | M3 |
| `src/main.js` | Test handler updates: the dialog's onFocus callback re-paints the overlay with the focused solution. Legend layout state machine (initial state from localStorage; default 'right'). Toggle buttons in the legend toolbar. **Fit-to-screen state + `applyFitToScreen()` helper called from legend changes + window resize + level reflow + play-mode entry/exit** | M3 + M4 |
| `src/style.css` | `.legend.layout-right` + `.legend.layout-bottom` (default) + `.legend.collapsed` rules. Right layout: legend in a column on the right of the canvas-wrap, ~200px. Collapsed: a 32-px-wide strip of role-icons. **`#fitBtn` matches toolbar-button styling; `#fitBtn.active` filled-icon variant** | M4 |
| `src/main.js` (template) | Legend element gets `data-layout` + `data-collapsed` attributes; toolbar above legend gets `[—]` (toggle collapsed) and `[↕]` (swap right ↔ bottom) buttons. **Main toolbar gains `[⛶]` (Fit) button between Play Settings and Test** | M4 |
| `tests/legend-layout.spec.js` (new) | Playwright suite: legend defaults to right; collapse button collapses; swap button toggles to bottom; localStorage persists across reloads. **Fit-to-screen toggle scales canvas; minimising legend triggers re-fit; localStorage persists fit-mode** | M4 |
| `src/style.css` | Add `body.playmode .legend { display: none; }` + `body.demomode .legend { display: none; }`. v22 `body.testmode` class — added by main.js when agent dialog opens, removed on close — hides the legend during agent search/results | M5 |
| `src/main.js` | Add/remove `body.testmode` class around `openAgentDialog`. Test that the legend is hidden during agent flow | M5 |
| `tests/agent-test-button.spec.js` | New cases: legend hidden during Test mode (when dialog is open); legend visible again after dialog closes | M5 |
| `tests/agent-test-button.spec.js` (extend) | New cases: tutorial.txt now solves (asserts `.badge.ok` + non-empty trace); multi-solution list shows multiple rows on a 2-pickup level | M6 |
| `TDDs/3_transcripts/version22_build.md` (new) | narrative, v8–v21 style | M6 |

## Milestone 1 — Spawn-fall settle

1. `src/play/playtestScene.js`:
   - In `restart()`, after `toWorld()` creates the player + entities:
     - Save the input reference.
     - Replace it with a no-input stub `{ isDown: () => false,
       wasPressed: () => false }`.
     - Run up to 30 iterations of `player.update(1/60, this)` —
       each frame is gravity + collision only, no key input.
     - Break early when `player.onGround === true`.
     - Restore the original input.
   - Reset `simFrame=0` and `simTime=0` AFTER the settle (so the
     input timeline starts AFTER the player has landed).
2. `tests/spawn-settle.spec.js`:
   - Playwright: load `tutorial.txt` (P 6 rows above floor),
     click Test. Even if the agent can't solve it yet (TSP
     fix is M2), assert the failure mode is NOT "unreachable
     from spawn" — settle made the spawn position match the
     agent's expectations.
   - Also: visual verification — load tutorial, press Play,
     player should be already grounded at game start (no
     visible fall).
3. **Visible after this commit**: pressing Play on a level
   where P spawns high above the floor no longer shows the
   player falling — they're already grounded. Agent's diagnostic
   improves on `tutorial.txt` (different failure mode).

Commit: `v22 m1: PlaytestScene spawn-fall settle (no-input gravity until onGround)`.

## Milestone 2 — TSP-optimal pickup ordering

1. `src/agent/planner.js`:
   - `resolveGoals` rewritten:
     - K = pickup count (or required-pickup-subset count).
     - K ≤ 4: enumerate all K! orderings (≤ 24). For each, sum
       A* leg costs. Pick min.
     - K > 4: greedy nearest-first (v21 fallback). Then 2-opt
       local search: try swapping each pair (i, j) in the
       ordering; keep the swap if it lowers cost; iterate until
       no improvement. Capped at ~50 iterations.
     - For pickup-required = K of M: enumerate combinations
       C(M, K) (≤ C(7, 3) = 35) × K!.
2. `src/agent/planner.test.js`:
   - New case: a 4-pickup level where greedy nearest-first
     picks a sub-optimal order; TSP-optimal picks the
     left-to-right order matching `tutorial.txt`'s `oooo` row.
   - New case: 2-opt local search improves a contrived 5-
     pickup arrangement.
3. **Visible after this commit**: `tutorial.txt`'s plan
   produces a sensible visit order (if M1's spawn-fall settle
   also resolved the unreachable diagnostic).

Commit: `v22 m2: TSP-optimal pickup ordering (K!≤4 exhaustive + 2-opt)`.

## Milestone 3 — Multi-solution enumeration

1. `src/agent/runner.js`:
   - `testLevel` returns `solutions: Array<Solution>` (up to 5
     unique by recording-hash).
   - Enumeration strategy: for each of the top-K goal orderings
     from M2, run plan + sim-validate. Keep unique recordings.
     Sort by total cost. Cap at 5.
   - Keep `solution = solutions[0]` (back-compat).
2. `src/agent/runner.test.js`:
   - Trivial level → 1 solution (no alternatives).
   - 2-pickup level → ≥ 2 solutions (different orderings).
3. `src/agentDialog.js`:
   - Success state renders the solutions list, each row with
     stats pills + a `[Demo]` button.
   - Clicking a row sets it as focused; trace + path-overlay
     re-render for the focused solution.
   - First row focused by default on dialog open.
4. `src/agent/overlay.js`:
   - `renderSolutionOverlay(ctx, solution, tile)` takes the
     SPECIFIC solution (not the full result). Caller picks
     which to render.
5. `src/main.js`:
   - The Test handler's `onFocus(solution)` callback re-paints
     the overlay (clears + draws the new focused solution).
6. **Visible after this commit**: the agent dialog lists multiple
   solutions when they exist; user can compare via the
   solution-row click + per-solution Demo.

Commit: `v22 m3: multi-solution enumeration (up to 5, sorted by cost) + dialog list UI`.

## Milestone 4 — Legend layout + fit-to-screen

1. `src/main.js`:
   - New module-level state:
     ```js
     let legendLayout = localStorage.getItem('v22.legendLayout') || 'right';
     let legendCollapsed = localStorage.getItem('v22.legendCollapsed') === 'true';
     let fitToScreen   = localStorage.getItem('v22.fitToScreen') === 'true';
     ```
   - Apply state on first render by setting classes on the
     `.legend` element.
   - Three new buttons:
     - `[—]` in the legend toolbar — toggles `legendCollapsed`.
     - `[↕]` in the legend toolbar — cycles `legendLayout`
       between 'right' and 'bottom'.
     - `[⛶]` (Fit) in the main toolbar (between Play Settings
       and Test) — toggles `fitToScreen`. The button gets
       `.active` class when on.
   - Each click persists to localStorage + re-applies via
     `setLegendLayout()` / `setLegendCollapsed()` /
     `applyFitToScreen()`.
   - `applyFitToScreen()` reads `.canvas-wrap` clientWidth/
     Height, computes `min(availW/intrinsicW, availH/intrinsicH)`,
     sets `previewCanvas.style.width/height`. Called on every
     legend change + `run()` reflow + window resize (debounced 50ms).
   - `tryPlaytest()` clears `previewCanvas.style.width/height`
     before setting the v18 play-mode pin; `exitPlaytest()`
     re-applies `applyFitToScreen()` after `run()` repaints.
2. `src/style.css`:
   - `.legend` base styles.
   - `.legend.layout-right`: positioned on the right of the
     canvas-wrap, width 200px, flex column.
   - `.legend.layout-bottom`: positioned below (v17 default).
   - `.legend.collapsed`: width 32px (right) or height 32px
     (bottom); shows just role-icon thumbnails.
   - `#fitBtn` matches `#playSettingsBtn` / `#testBtn` toolbar
     buttons; `#fitBtn.active` gets a filled-icon variant
     (slightly brighter background) so the user sees fit-mode
     is on.
3. `tests/legend-layout.spec.js`:
   - Default load: `.legend.layout-right` class present.
   - Click `[—]`: `.legend.collapsed` class added.
   - Click `[↕]`: layout swaps to 'bottom'.
   - Click `[⛶]`: canvas inline `style.width` set; click again
     clears it.
   - Click `[⛶]` then `[—]`: canvas re-fits (inline style.width
     grows because wrap widened by ~170 px).
   - Reload page: all three stored choices restored (layout +
     collapsed + fit-mode).

Commit: `v22 m4: legend layout — right-side default + min/max + bottom swap + fit-to-screen`.

## Milestone 5 — Hide legend in Play / Test / Demo modes

1. `src/style.css`:
   - `body.playmode .legend { display: none; }` (extends v18
     `.edit-only` pattern).
   - `body.demomode .legend { display: none; }` (v20+).
   - `body.testmode .legend { display: none; }` (NEW v22).
2. `src/main.js`:
   - In the `#testBtn` click handler, before
     `openAgentDialog(...)`: add `body.testmode`.
   - In the dialog's `onClose` callback: remove `body.testmode`.
3. `tests/agent-test-button.spec.js`:
   - New case: legend element is hidden (computed `display: none`)
     during the agent search; visible again after dialog close.

Commit: `v22 m5: hide legend in Play / Demo / Test modes`.

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `tests/agent-test-button.spec.js` (extend):
   - `tutorial.txt` solves end-to-end: `.badge.ok` + ≥ 6
     trace entries (4 pickups + ≥ 1 jump + exit walk).
   - Multi-solution list: a 2-pickup level shows ≥ 2 solution
     rows.
2. `TDDs/3_transcripts/version22_build.md`: narrative covering
   the spawn-fall settle (the unsung architectural fix), the
   TSP-optimal pickup ordering (why greedy failed on
   `tutorial.txt`), the multi-solution enumeration (how
   distinct recordings are detected), the legend layout (right-
   side default + min/max + swap), and the v22 "standing gap"
   (`below_ground.txt` may still fail if its issue is hazard-
   touch during a specific trajectory — documented as v23
   candidate).
3. Mark design + impl Delivered with the M1–M6 commit-hash
   table.

Commit: `v22 m6: agent e2e + v22 transcript; design + impl Delivered`.

## Risks & sequencing

- **M1 spawn-fall settle**: the 30-frame cap is conservative.
  Pathological levels with deep falls (P 30+ rows above floor)
  would settle past the cap, then continue falling in the live
  engine after game.start(). Acceptable — no shipped level has
  that profile.
- **M2 TSP combinatorics**: K=4 exhaustive is bounded. K=5
  with 2-opt is bounded. K=10 would be 50 iterations of swap
  testing ≈ 50 × (4 × 50ms A*) = 10s — past the 5s budget.
  Mitigation: count combinations × orderings against budget
  before running.
- **M3 multi-solution duplicate-detection**: two orderings can
  produce identical recordings (e.g. when goals are
  collinear). Mitigation: hash recordings by their event
  sequence; only add unique hashes to the list.
- **M4 layout shift**: changing legend position mid-session
  could cause the editor canvas to reflow and lose the user's
  scroll position. Mitigation: use CSS grid with fixed columns
  so the canvas-wrap dimensions don't change.
- **M4 fit-to-screen resize loop**: fit-mode sets inline
  width/height on `#preview`. If the wrap's dims change in
  response (e.g. scrollbar appearance), the resize listener
  fires again. Mitigation: debounce 50 ms + read `clientWidth/
  Height` (excludes scrollbar) — never `getBoundingClientRect()`.
- **M4 fit-mode vs Play/Demo/Test pin**: v18's hotfix sets
  `previewCanvas.style.width` for the play-mode CSS pin; fit-
  mode also sets inline width. `tryPlaytest()` clears fit's
  inline styles before applying its own pin; `exitPlaytest()`
  re-applies fit-mode after the editor's run() repaints.
- **M5 testmode body class**: must be ADDED/REMOVED reliably
  around the agent dialog. If the dialog crashes (rare), the
  class would stick. Mitigation: also remove the class in a
  finally-block or on dialog construction (idempotent reset).
- **No deploy risk** — bundle grows by ~5–7KB (TSP + multi-
  solution + dialog list renderer + layout CSS).

## Deferred (design §9 → v23+)

- **Multi-coloured overlay rendering** for multi-solution
  display.
- **Backtracking around walls** — collect-key-then-return.
- **Author-difficulty rating** — composite from solution
  stats.
- **Web Worker for big-world graph build**.
- **Multi-level cross-agent** — pairs with future
  doors / tunnels.
- **Author-resizable legend width** (right-side layout).
- **Drag-and-drop legend reorder** — change role group order.
- **Per-tileset legend customisation persistence** — remember
  collapsed state per tileset.

Plus the long-standing v16/v17/v18/v19 carry-overs.
