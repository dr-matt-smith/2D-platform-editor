# Version 23 — Implementation Plan

Status: Proposed · Date: 2026-05-22 · Design:
[../1_design/version23_design.md](../1_design/version23_design.md)

Seven small path-scoped commits. The two threads — editor / play
polish (M1–M5) and agent action-graph completeness (M6) — interleave
in low-risk order: tiny CSS / template changes land first, the
larger agent work lands as the acceptance-gated finale, then docs.

## Process (same discipline as v8–v22)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/` / tileset `src.txt` / `sources.txt`
  files stay out.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v23 only touches v9-original
  glue (`playtestScene.js`, `launcher.js`), editor modules, and
  `src/agent/*`.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - The agent's public entry `testLevel(...)` return shape stays
    `{ ok, solutions, solution, lastPlan, lastSim }`. M6 adds new
    action types ADDITIVELY — `enumerateActions` returns a longer
    list; downstream callers iterate it the same way.
  - The light-theme `body.lightmode` selector is **opt-in via the
    toggle**; first-load default is dark (matches v22 behaviour).
  - The viewport-guide overlay is editor-only and additive — paints
    in a new pass on the existing `#overlay` canvas, no change to
    the renderer's draw chain in Play/Demo/Test.
- **Fit-in-Play is the riskiest editor change** because it changes
  v18's CSS pin formula. Mitigation: gate behind the existing
  `fitToScreen` flag; when off, the pin formula is BYTE-identical
  to v18.
- **Action-graph completeness scope-cap**: v23 ships ONLY the three
  new edge types (`run_off`, `drop_carry`, `precision_landing`).
  No changes to the planner's TSP ordering or the runner's multi-
  solution loop — those are v22's contracts.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/style.css` | `.toolbar { min-height: 38px; align-items: center }` so the row doesn't shrink in playmode | M1 |
| `src/playSettingsDialog.js` (or wherever the popup template lives) | `<header class="play-settings-header">` + `<hr class="popup-divider">` between the Viewport block and the Pickup-Required block | M1 |
| `src/style.css` | `.play-settings-header` + `.popup-divider` rules | M1 |
| `tests/v23-toolbar-pin.spec.js` (new) | Asserts canvas `getBoundingClientRect().top` is identical in edit vs play (delta ≤ 1 px to allow sub-pixel rounding) | M1 |
| `src/style.css` | `body.lightmode { --bg/--fg/--line/--dim/--accent: … }` re-binding; `#themeBtn` toolbar-button style | M2 |
| `src/main.js` | `let theme = readPref('v23.theme', 'dark'); applyTheme();` + `#themeBtn` click handler that toggles + persists. Sun/moon glyph reflects current state | M2 |
| `src/main.js` (template) | `<button id="themeBtn" class="edit-only" title="…">🌗</button>` next to `#fitBtn` | M2 |
| `tests/v23-theme.spec.js` (new) | Asserts initial state is dark; click → `body.lightmode` class; `getComputedStyle(document.body).backgroundColor` differs from dark theme; reload → restored | M2 |
| `src/main.js` | New `drawViewportGuide(octx, parsed, tile)` function. Called from the editor's overlay-paint chain (same place the marquee renders from). Reads `parsed.meta.viewport`; centres the dashed rect on the P spawn cell, clamps to world bounds. Editor-only — no-op in Play/Demo/Test | M3 |
| `src/style.css` | (no change — dashed-rect colour is inline via `octx.strokeStyle`) | — |
| `tests/v23-viewport-guide.spec.js` (new) | Loads a level with `# viewport: 8x6` on a 24×14 grid; samples overlay pixels at the expected dashed-rect bounds; asserts non-zero alpha on the edge AND zero in the interior | M3 |
| `src/main.js` (`tryPlaytest()` + `exitPlaytest()`) | Honour `fitToScreen` in both fit-whole-level and scrolling-window viewport modes; refactor the CSS pin formula to multiply intrinsic dims by `scale = fitToScreen ? min(availW/iW, availH/iH) : 1` | M4 |
| `src/main.js` (testBtn handler) | `requestAnimationFrame(() => applyFitToScreen())` after `openAgentDialog` so the layout has recalc'd post-`testmode` add | M4 |
| `src/main.js` (resize listener) | Extend the 50ms-debounced `window.resize` to also re-apply the play-mode pin while in play | M4 |
| `tests/v23-fit-play.spec.js` (new) | Turn Fit on in Design (click `#fitBtn`); enter Play; assert canvas inline `style.width` matches `Math.floor(intrinsicW * scale)` ± 1 px | M4 |
| `src/agentDialog.js` | New `renderMinimised(solutions, focusedIdx)` template — a floating bar pinned at the top of the canvas-wrap with focused-row pills + Demo + Expand + Close. `[—]` button in the full dialog swaps to minimised; `[↕ Expand]` in the bar swaps back. State persisted via `v23.dialogMinimised` | M5 |
| `src/style.css` | `.minimised-solutions` floating-bar rule (transparent backdrop, accent-bordered pill, pinned via `position: absolute` inside the canvas-wrap) | M5 |
| `tests/v23-minimise-solutions.spec.js` (new) | Open dialog on a solvable level; click `[—]`; assert `.modal-backdrop` is gone and `.minimised-solutions` is visible AND the path overlay is visible (sample a known overlay pixel). Click Expand → full dialog back. Reload → minimised state restored | M5 |
| `src/agent/actions.js` | `enumerateActions(grid, cell, ctx)` returns: existing v21 actions, plus `run_off` (dir ∈ {L,R}, walkCells ∈ {2..8}) when cell is at platform edge, plus `drop_carry` (dir ∈ {L,R}) when cell is at platform edge with empty space below. `actionToRecording(action)` emits the right input timeline for each new type. `actionToWhy(action)` returns the human-readable trace string | M6 |
| `src/agent/actions.test.js` | New unit cases: `run_off` recording holds direction key across full fall; `drop_carry` recording differs from v21 `drop` (direction held throughout); enumeration includes both at platform-edge cells and excludes them elsewhere | M6 |
| `src/agent/grid.js` | `buildNavGraph` accepts a `precisionTargets` set (pickup cells + exit cell). Edge-accept rule extended: an action's edge is also accepted if the action's parabola passes within ±2 px of a target's cell centre — emit an edge to that target's cell in addition to (or instead of) the cell-resolved end | M6 |
| `src/agent/grid.test.js` | New case: a 1-tile pickup midway between two grounded cells is reachable via a `run_off` edge with `precision_landing` | M6 |
| `tests/v23-tutorial-solves.spec.js` (new) | Loads `tutorial.txt` via fetch; clicks Test; waits for `.badge.ok` within 5 s; asserts ≥ 4 pickups in the focused solution's stat-pill | M6 |
| `TDDs/3_transcripts/version23_build.md` (new) | narrative covering toolbar pin / popup polish / theme toggle / viewport guide / fit-play / minimise / action-graph + `tutorial.txt` solve (or the documented partial outcome) | M7 |

## Milestone 1 — Toolbar pin + Play Settings popup polish

1. `src/style.css`:
   - `.toolbar { min-height: 38px; align-items: center; }` (the
     value chosen to match the natural edit-mode height — see §6 of
     the design).
   - `.play-settings-header { font: 600 15px var(--font-stack);
     border-bottom: 1px solid var(--line); padding-bottom: 8px;
     margin-bottom: 12px; }`
   - `.popup-divider { border: none; border-top: 2px solid
     var(--accent); margin: 14px 0; }`
2. `src/playSettingsDialog.js` (verify module location first —
   may live inline in main.js or in a dedicated module):
   - Prepend `<header class="play-settings-header">Play Settings</header>`.
   - Insert `<hr class="popup-divider">` between the viewport
     `<fieldset>` and the pickup-required `<fieldset>`.
3. `tests/v23-toolbar-pin.spec.js`:
   - Load app; capture `#preview.getBoundingClientRect().top` in
     edit mode.
   - Click `#playBtn`; capture again.
   - Assert `|topEdit − topPlay| ≤ 1` (1px tolerance for sub-pixel
     rounding on Retina / 125% zoom).
4. **Visible after this commit**: toolbar height stays put when
   entering Play; Play Settings popup has a title bar and a clear
   divider between Viewport and Pickup blocks.

Commit: `v23 m1: toolbar height pin + Play Settings popup title/HR`.

## Milestone 2 — Light / dark mode toggle

1. `src/style.css`:
   - At top of file (alongside the existing `:root { --bg: ... }`):
     ```css
     body.lightmode {
       --bg: #f6f6f6;
       --fg: #1a1a1a;
       --dim: #666;
       --line: #ccc;
       --accent: #1e7e34;
     }
     ```
   - `#themeBtn` rule (same shape as `#fitBtn` — toolbar-button
     look).
2. `src/main.js`:
   - `<button id="themeBtn" class="edit-only" title="Toggle light/dark mode">🌗</button>`
     in the toolbar template, between `#fitBtn` and `#playBtn`.
   - `let theme = readPref('v23.theme', 'dark');` (using the same
     `readPref` helper added in v22 M4).
   - `function applyTheme() { document.body.classList.toggle('lightmode', theme === 'light'); }`
   - Call `applyTheme()` once at module init.
   - `#themeBtn` click → flip + persist + `applyTheme()`.
3. `tests/v23-theme.spec.js`:
   - Initial: `body` does NOT have `lightmode` class; `document.body
     .style.backgroundColor` resolves dark.
   - Click `#themeBtn`: class added; bg colour differs.
   - Reload: class restored from localStorage.
4. **Visible after this commit**: 🌗 toolbar button toggles the
   whole editor between dark and light themes; survives reload.

Commit: `v23 m2: light/dark mode toggle (localStorage-persisted)`.

## Milestone 3 — Viewport bounding rectangle (Design mode only)

1. `src/main.js`:
   - New helper:
     ```js
     function drawViewportGuide(octx, parsed, tile) {
       if (!parsed.meta.viewport) return;
       if (editorMode !== 'edit') return;
       const { w: vw, h: vh } = parsed.meta.viewport;
       // Focus cell: player spawn if present, else geometric centre.
       const spawn = findGlyph(parsed.grid, 'P');
       const cx = spawn ? spawn.c : Math.floor(parsed.meta.width / 2);
       const cy = spawn ? spawn.r : Math.floor(parsed.meta.height / 2);
       const x = clamp((cx - vw / 2) * tile, 0, (parsed.meta.width - vw) * tile);
       const y = clamp((cy - vh / 2) * tile, 0, (parsed.meta.height - vh) * tile);
       octx.save();
       octx.setLineDash([6, 4]);
       octx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
       octx.lineWidth = 2;
       octx.strokeRect(x + 1, y + 1, vw * tile - 2, vh * tile - 2);
       octx.restore();
     }
     ```
   - Called from the editor's overlay-paint chain. Specifically:
     after the marquee/rect-draw guides paint (so the guide sits
     ON TOP of any in-progress drag rectangle visually).
   - `clearOverlay()` already clears the canvas on each redraw; the
     guide repaints from the same chain — no manual invalidation
     needed.
2. `tests/v23-viewport-guide.spec.js`:
   - Load a 24×14 level with `# viewport: 8x6`. Inject via the
     usual `#src` value-set.
   - Sample overlay pixels at expected edge coordinates (cell × tile
     ± 2 px); assert non-zero alpha.
   - Sample overlay pixel in the INTERIOR (well inside the rect);
     assert alpha = 0 (just an outline, not a fill).
   - Enter Play; assert overlay is now blank at the same coordinates
     (editor-only).
3. **Visible after this commit**: the design canvas shows a
   yellow dashed rectangle around the visible viewport when the
   level declares one; vanishes in Play/Demo/Test.

Commit: `v23 m3: viewport bounding rectangle on editor overlay`.

## Milestone 4 — Fit-to-screen ↔ Play/Test

1. `src/main.js` — refactor `tryPlaytest()`:
   - Before: `previewCanvas.style.width = pinCells * engineTILE + 'px'`.
   - After:
     ```js
     const intrinsicW = pinCells * engineTILE;
     const intrinsicH = pinRows  * engineTILE;
     if (fitToScreen) {
       const wrap = document.querySelector('.canvas-wrap');
       const availW = wrap.clientWidth - 24;
       const availH = wrap.clientHeight - 24;
       const scale = Math.min(availW / intrinsicW, availH / intrinsicH);
       previewCanvas.style.width  = `${Math.floor(intrinsicW * scale)}px`;
       previewCanvas.style.height = `${Math.floor(intrinsicH * scale)}px`;
     } else {
       previewCanvas.style.width  = `${intrinsicW}px`;
       previewCanvas.style.height = `${intrinsicH}px`;
     }
     ```
   - Same formula for both fit-whole-level (`pinCells = meta.width`)
     and scrolling-window (`pinCells = meta.viewport.w`).
2. `src/main.js` — extend the resize listener:
   - Current: only calls `applyFitToScreen()` (editor-only via the
     early-return on `editorMode === 'play'`).
   - v23: also re-applies the play-mode pin when in play, using the
     same formula as `tryPlaytest`.
3. `src/main.js` — testBtn handler:
   - Add `requestAnimationFrame` defer around `applyFitToScreen()`
     after `openAgentDialog(…)`:
     ```js
     document.body.classList.add('testmode');
     requestAnimationFrame(() => applyFitToScreen()); // wait for layout
     openAgentDialog({...});
     ```
4. `tests/v23-fit-play.spec.js`:
   - Load app; click `#fitBtn` to turn Fit on.
   - Read `#preview.style.width` in edit mode; remember.
   - Enter Play; read again; assert ≈ same (≤ 2 px delta).
   - Exit Play; read again; assert restored.
5. **Visible after this commit**: pressing Play (or Test) with Fit
   on keeps the canvas at the same on-screen size — no "squashing"
   when the legend / dialog frees up wrap space.

Commit: `v23 m4: honour fit-to-screen in Play and Test modes`.

## Milestone 5 — Minimise solutions panel

1. `src/agentDialog.js`:
   - Add a `[—]` minimise button in `renderSuccess`'s header:
     ```js
     <button class="agent-min-btn" data-act="minimise" title="Minimise (keep path visible)">—</button>
     ```
   - New renderer `renderMinimised(solutions, focusedIdx)`:
     ```html
     <div class="minimised-solutions" role="dialog" aria-label="…">
       <span class="badge ok">✓ N solutions</span>
       <span class="stat-pill">…steps</span>
       <span class="stat-pill">…jumps</span>
       <span class="stat-pill">…pickups</span>
       <button data-act="demo" class="cf-btn primary">▶ Demo</button>
       <button data-act="expand" class="cf-btn">↕ Expand</button>
       <button data-act="close"  class="cf-btn">×</button>
     </div>
     ```
   - The minimised bar attaches DIRECTLY to the document body but
     uses `position: absolute` to land at the top of `.canvas-wrap`
     (the wrap has `position: relative` already from v18).
   - `handleAct('minimise')` → swap render + remove modal backdrop.
   - `handleAct('expand')` → swap back to full dialog.
   - Persist state via `localStorage.setItem('v23.dialogMinimised', …)`;
     read on next `renderSuccess` call.
2. `src/style.css`:
   - `.minimised-solutions {`
     ```css
       position: absolute;
       top: 8px; left: 50%; transform: translateX(-50%);
       display: flex; gap: 8px; align-items: center;
       padding: 6px 10px;
       background: var(--bg); border: 2px solid var(--accent);
       border-radius: 6px;
       box-shadow: 0 2px 8px rgba(0,0,0,0.3);
       z-index: 10;
     ```
3. `tests/v23-minimise-solutions.spec.js`:
   - Open agent on a solvable level → wait for `.badge.ok`.
   - Click `[data-act="minimise"]`.
   - Assert `.modal-backdrop` is gone.
   - Assert `.minimised-solutions` is visible.
   - Sample a known overlay pixel near the focused solution's path
     — assert non-zero alpha (path visible).
   - Click `[data-act="expand"]` → dialog returns.
   - Reload page; re-run; assert minimised state restored.
4. **Visible after this commit**: the agent dialog can be
   collapsed into a top bar; the path overlay stays visible
   while collapsed.

Commit: `v23 m5: minimisable solutions panel (keep path overlay visible)`.

## Milestone 6 — Agent action-graph completeness

1. `src/agent/actions.js`:
   - Define new action shapes:
     ```js
     // Run off a platform edge with carry-direction held throughout.
     { type: 'run_off', dir: 'L'|'R', walkCells: 2..8 }
     // Drop straight off a ledge with direction held the whole fall.
     { type: 'drop_carry', dir: 'L'|'R' }
     ```
   - `enumerateActions(grid, cell, ctx)` extended: when the cell
     is at a platform edge (its dir-neighbour is empty AND below
     the dir-neighbour is empty), enumerate `run_off` (walkCells
     ∈ 2..8) and `drop_carry`.
   - `actionToRecording(action)`:
     - `run_off`: hold dir key for `walkCells * 8` ticks (the walk),
       then continue holding through ~30 frames of fall, terminate
       when sim says `onGround` again.
     - `drop_carry`: hold dir key from frame 1 through ~30 frames of
       fall, terminate on landing.
   - `actionToWhy(action)`:
     - `run_off`: `"run off ${dir} platform after ${walkCells} steps, carry direction through fall"`
     - `drop_carry`: `"drop ${dir} off edge with direction held"`
2. `src/agent/actions.test.js`:
   - +3 cases:
     - `enumerateActions` returns `run_off` actions at platform-edge
       cells AND excludes them at interior cells.
     - `actionToRecording({type:'drop_carry',dir:'R'})` emits a
       recording where the right key is held every frame for the
       fall duration.
     - `actionToWhy` round-trips for both new types.
3. `src/agent/grid.js`:
   - `buildNavGraph(parsed, legend, ctx)` accepts an optional
     `precisionTargets: Set<cellKey>` — the set of pickup cells +
     exit cell, computed once from `parsed.grid`.
   - For each candidate action, after simulating, ALSO check if the
     player's centre-X at any frame was within ±2 px of a target's
     cell centre AND the player was inside that target's cell row.
     If so, emit an edge to that target's cell in addition to the
     cell-resolved end.
4. `src/agent/grid.test.js`:
   - +1 case: a 1-tile pickup at the bottom of a fall arc is
     reachable via a `run_off` edge with precision_landing.
5. `tests/v23-tutorial-solves.spec.js`:
   - `tutorial.txt` solves: `.badge.ok` within 5s budget; focused
     solution's pickup-pill text contains "4 pickups" (the four
     `o` glyphs in the `oooo` row).
6. Re-run the agent on `below_ground.txt`:
   - If solves: assert in a new case `tests/v23-below-ground.spec.js`.
   - If still fails: document the remaining failure mode in the
     v23 transcript; not blocking M6 success.
7. **Visible after this commit**: `tutorial.txt` now reports
   `✓ Level completable` with a four-pickup trace; the path
   overlay traces the run-off-platform → catch-on-`oooo`-row →
   continue-to-exit arc.

Commit: `v23 m6: agent action-graph completeness — run_off + drop_carry + precision_landing`.

## Milestone 7 — Acceptance e2e + transcript + Delivered

1. `tests/v23-acceptance.spec.js`:
   - Cover any cross-cutting assertions that span M1–M6 (e.g.
     "themed editor still solves tutorial.txt").
2. `TDDs/3_transcripts/version23_build.md`: narrative covering
   each milestone, the action-graph diagnostic chain
   (spawn-settle → TSP-optimal → multi-solution → action-graph),
   the `below_ground.txt` outcome (whichever it lands at), and the
   user's polish-thread items in story form.
3. Mark design + impl Delivered with the M1–M7 commit-hash table
   (matching v22's pattern).

Commit: `v23 m7: acceptance e2e + v23 transcript; design + impl Delivered`.

## Risks & sequencing

- **M1 toolbar `min-height: 38px`**: hard-coded value. Mitigation:
  Playwright assertion is ≤ 1 px delta, allowing room for fonts /
  zoom. Document the value; v24 candidate to read at runtime.
- **M2 light theme on dialog backdrops**: the v22 dialog system
  uses semi-transparent backdrops. Mitigation: re-bind the
  backdrop colour via a custom property; test both themes in the
  agent-dialog e2e suite (lightmode on, dialog opens, modal
  visible).
- **M3 viewport-guide repaint vs marquee**: both share `#overlay`.
  Mitigation: integrate into the existing overlay-clear-and-paint
  chain; guide paints AFTER marquee so it sits visually on top.
- **M4 fit-in-Play resize loop**: same risk as v22's wrap-fit.
  Same mitigation: `clientWidth` (excludes scrollbars); debounced
  resize.
- **M5 minimised-bar z-order**: must sit above `#overlay` but below
  any other modal. Mitigation: `z-index: 10` (overlay has none /
  z-index: auto; modal-backdrop is `z-index: 100`).
- **M6 action enumeration blow-up**: ~28 → ~36 per cell. Graph
  build grows ~30%. Mitigation: profile during dev; gate
  `precision_landing` to within K tiles of a target if budget-tight.
- **M6 `precision_landing` false positives**: an arc that ALSO
  crosses a wall in the same frame should not be edge-accepted.
  Mitigation: re-use the existing collision check in `simAction` —
  only "landed cleanly" edges qualify.
- **M6 `below_ground.txt`**: may not be fixed by action-graph
  completeness alone. Mitigation: NOT a hard acceptance criterion
  (mentioned in the design §7 conditionally); document remaining
  failure mode for v24.
- **No deploy risk** — bundle grows ~4–6 KB (theme CSS + action
  enumeration code + minimise-solutions renderer).

## Deferred (design §9 → v24+)

- **Runtime-measured toolbar height** — read at first paint into
  `--toolbar-h` for sub-pixel-perfect match.
- **Viewport guide follows mouse** — drag-to-pan the guide.
- **Multi-coloured path overlay** for multi-solution display.
- **Backtracking around walls** — collect-key-then-return.
- **Author-difficulty rating** — composite from solution stats.
- **Web Worker for big-world graph build**.
- **Multi-level cross-agent** — doors / tunnels.
- **Author-resizable legend width** (right-side layout).
- **Drag-and-drop legend reorder**.
- **Per-tileset legend customisation persistence**.
- **`prefers-color-scheme` first-load theme default**.
- **Light-theme path-overlay colours** — iterate after M2 ships.

Plus the long-standing v16/v17/v18/v19 carry-overs.
