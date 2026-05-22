# 2D Level Designer — Version 23 Design Document

Status: Proposed · Date: 2026-05-22 · Builds on:
[version22_design.md](version22_design.md) (TSP-optimal agent + legend
layout + locked-exit sprite via `imageLocked`) · Implementation:
*to follow once this scope is approved*.

## 1. Purpose

A coherent bundle of **two threads** — editor / play polish (Thread A,
M1–M5) and the action-graph completeness work that v22 deferred
(Thread B, M6). The threads share no architectural overlap but
co-habit cleanly in the milestone sequence: UI polish lands first
(low risk, fast feedback) and the agent work lands as the larger,
acceptance-gated finale.

### Thread A — Editor / play polish

Five small wishlist items the user added after v22 shipped, each
self-contained:

1. **Toolbar-height pin between Design and Play modes** — switching
   from edit to play visibly shifts the canvas a pixel or two up,
   because the edit-mode toolbar (selects + Play-Settings + Fit +
   Test) is taller than the play-mode toolbar (Restart + Exit). The
   delta in `flex-direction: row` height propagates down to the
   `.canvas-wrap`. Pin the toolbar height at the edit-mode value so
   the canvas origin doesn't move.
2. **Play Settings popup polish** — add a popup title and a high-
   contrast horizontal rule between the Viewport settings block and
   the Pickup-Requirement block.
3. **Light / dark mode toggle** — a small toolbar button (sun / moon
   icon) that flips the editor between the current dark theme and a
   new light theme. Persisted in localStorage. All five existing CSS
   custom-properties (`--bg`, `--fg`, `--line`, `--dim`, `--accent`)
   already gate every coloured element; a `body.lightmode` selector
   re-binds them.
4. **Viewport bounding rectangle in Design mode** — when the level
   sets `# viewport: WxH` (scrolling-window mode), draw a dashed
   rectangle on the editor's overlay canvas showing the play-time
   visible band centred on the player's spawn (or following the
   most-recently-edited cell). Currently the author has no visual
   cue for which part of a large level will be on-screen at game
   start. Editor only — vanishes in Play/Demo/Test.
5. **Fit-to-screen ↔ Play/Test sizing** — v22 ships `applyFitToScreen()`
   for the editor canvas, but entering Play or Test clears the
   inline width/height (the v18 CSS pin owns canvas sizing in play
   mode). Two consequences the user observed:
   - In **Test mode**, the agent dialog hides the legend (v22 M5),
     freeing space, but the canvas keeps its fixed intrinsic size
     and looks "squashed" relative to the now-larger wrap.
   - In **Play mode with viewport = "fit whole level"** (no scrolling
     window), the canvas snaps to its intrinsic dims; if Fit was on
     in Design, the user expects the same scaled size in Play.
   - In **Play mode with viewport = scrolling window** the canvas
     pin is sized to the viewport cells, NOT the available wrap —
     the player sees the viewport at 1:1 intrinsic pixels regardless
     of the wrap's actual size.
   Fix: thread `fitToScreen` (and the wrap dims) into the play-mode
   sizing path; for scrolling-window levels, multiply the pin's
   width/height by the wrap-fit scale so the visible viewport fills
   the available area.

### Thread B — Agent action-graph completeness

The v22 acceptance gap. `tutorial.txt` still reports "Exit unreachable
from spawn" even with M1's spawn-fall settle and M2's TSP-optimal
pickup ordering — because the v21 action enumeration (walk-cells,
12-frame-release jumps, drops) does not include the trajectories the
level actually requires:

1. **`run_off_platform_then_walk_mid_air`** — leave a ledge while
   moving horizontally; carry vx into the fall and continue holding
   the direction. v22's walk action stops at the ledge; v21's drop
   action zeros vx.
2. **`drop_with_horizontal_carry`** — start with `onGround=true` at
   the ledge cell; release ground, hold direction throughout the
   fall. Like v21's drop but with an input timeline that fires the
   direction key every frame instead of just the initial drop.
3. **`precision_landing`** — terminate a jump/fall such that the
   player's centre-X is within ±2 px of a 1-tile-wide target cell.
   Needed for cherry-on-pillar and `oooo`-row catches; the v22
   tower-cherry case worked because the pillar was 3 wide, not 1.

These extend the action enumeration (~28 → ~36 candidates per
grounded cell) without changing the graph builder's shape. Edge
construction by simulation still owns the "did we actually land
here" answer.

Also re-investigate `below_ground.txt`'s "dead at frame 49" — likely
a hazard touch during a spawn-fall; may share a root cause with the
spawn-fall edge cases that drove M1.

## 2. Current state

### Editor (v22):

- Toolbar in edit mode: `[Tileset:][Level:]` selects + `[Reload][New]
  [Save]` + `[Play Settings][⛶ Fit][Play][Test]`. ~10 controls in a
  flex row.
- Toolbar in play mode: `[Restart][Exit]`. 2 controls.
- Toolbar height shrinks ~2 px when entering Play because the
  `<select>` controls are taller than the buttons. `.canvas-wrap`
  expands to fill the freed pixels → canvas shifts up.
- Play Settings popup: a `.modal-backdrop` with viewport-cells +
  pickup-required controls stacked vertically. No title bar; no
  visual divider between the two settings sections.
- Single dark theme (`--bg: #1e1e1e`, `--fg: #e0e0e0`, etc.); no
  toggle, no localStorage.
- Viewport (`# viewport: WxH`) is invisible in Design mode — the
  author edits the world at full size and only sees the viewport
  band when they enter Play.
- Fit-to-screen scales the Design canvas but is disabled in Play /
  Demo / Test (CSS hides the button; `applyFitToScreen()` early-
  returns on those modes; tryPlaytest clears the inline style).
- Agent dialog: solutions list + open-by-default trace + path-overlay
  rendered on `#overlay`. The dialog modal-backdrop covers the
  canvas; the user can't see the overlay until they close the
  dialog.

### Agent (v22):

- ~28 actions enumerated per grounded cell (2 walks + 24 jumps × 12
  release-frames × 2 dirs + 2 drops).
- TSP-optimal pickup ordering (`K!≤4` exhaustive + 2-opt).
- Multi-solution enumeration (up to 5 by edge-blocking + re-plan).
- `tutorial.txt` reports "Exit unreachable" — the action set lacks
  the run-off-platform / drop-with-carry / precision-landing edges
  needed to traverse the level's `oooo` row.
- `below_ground.txt` dies at frame 49 — hazard touch during spawn-
  fall or early walk.

## 3. Architecture

### 3.1  Toolbar-height pin (M1.a)

Add `min-height` to `.toolbar` matching the natural edit-mode
height (measured at first paint after fonts load). Apply
unconditionally — same value for `body.playmode`.

```css
.toolbar { min-height: 38px; align-items: center; }
```

Optional refinement: read the height after first edit-mode paint
into a CSS custom property `--toolbar-h`; `body.playmode .toolbar
{ height: var(--toolbar-h); }`. The static `min-height: 38px`
approach is simpler and matches reality on the shipped fonts.

### 3.2  Play Settings popup polish (M1.b)

`src/playSettingsDialog.js` (or wherever the popup template lives)
gains:

```html
<header class="play-settings-header">Play Settings</header>
<!-- Viewport block -->
<hr class="popup-divider">
<!-- Pickup-Requirement block -->
```

CSS:
```css
.play-settings-header {
  font-weight: 600;
  font-size: 15px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
  margin-bottom: 12px;
}
.popup-divider {
  border: none;
  border-top: 2px solid var(--accent);
  margin: 14px 0;
}
```

### 3.3  Light / dark mode (M2)

New module-level state:
```js
let theme = localStorage.getItem('v23.theme') || 'dark';
applyTheme();
```

`applyTheme()` toggles `body.lightmode`. CSS:

```css
body.lightmode {
  --bg: #f6f6f6;
  --fg: #1a1a1a;
  --dim: #666;
  --line: #ccc;
  --accent: #1e7e34;
}
```

(Accent colour swap — green stays green in both themes but the dark
green hex is too dim against the light background.)

Toolbar button — a single Unicode glyph:
```html
<button id="themeBtn" class="edit-only" title="Toggle light/dark mode">🌗</button>
```

Click handler toggles + persists. Optional: `prefers-color-scheme`
media query as the FIRST-load default (before user has clicked).

### 3.4  Viewport bounding rectangle (M3)

`src/main.js`'s editor-mode draw chain already paints the level into
`#preview` and uses `#overlay` for marquee / rect-draw guides. Add a
new pass:

```js
function drawViewportGuide(octx, parsed, tile) {
  if (!parsed.meta.viewport) return;
  const { w: vw, h: vh } = parsed.meta.viewport;
  const cx = /* current visible focus — see below */ ;
  // Centre the viewport rect on the focus cell, clamped to world.
  const x = clamp((cx - vw / 2) * tile, 0, (parsed.meta.width - vw) * tile);
  const y = /* analogous for y */ ;
  octx.save();
  octx.setLineDash([6, 4]);
  octx.strokeStyle = 'rgba(255, 220, 100, 0.9)';
  octx.lineWidth = 2;
  octx.strokeRect(x, y, vw * tile, vh * tile);
  octx.restore();
}
```

**Focus heuristic** (open question — proposed default):
- If the player spawn (`P`) is in the parsed grid: centre on its
  cell.
- Otherwise centre on the level's geometric centre.
- v23+ candidate: follow the most-recently-edited cell.

Drawn ONLY in edit mode (Play/Demo/Test have their own viewport
mechanism via the camera).

### 3.5  Fit-to-screen ↔ Play/Test (M4)

Three sub-fixes inside the existing `applyFitToScreen()` +
`tryPlaytest()` / `exitPlaytest()` paths.

**3.5.a — Test mode** (currently squashed):

The agent dialog opens in `body.testmode`; v22 M5's CSS collapses
the legend track to zero so the canvas-wrap widens. But
`applyFitToScreen()` already runs on testmode enter/exit (the v22
M5 wiring). The "squashed" report suggests the inline width/height
that `applyFitToScreen()` sets uses the canvas's `width` / `height`
attributes (which match the EDITOR tile size of 24, not the engine
tile of 20). When the dialog opens, no level reflow happens, so the
intrinsic dims stay editor-sized; the fit math is unchanged. **The
fix is to read `clientHeight` after the dialog opens** (post-CSS
recalc) and to call `applyFitToScreen()` AFTER the dialog has
painted, not before. Adds a one-frame `requestAnimationFrame`
defer.

**3.5.b — Play mode, fit-whole-level (no viewport)**:

v18's CSS pin in `tryPlaytest()` sets:
```js
previewCanvas.style.width = `${pinCells * engineTILE}px`;
```
This is the INTRINSIC width — not scaled for the wrap. v23 changes
this to honour the editor's current fit-mode:
```js
const wrap = document.querySelector('.canvas-wrap');
const availW = wrap.clientWidth - 24;
const availH = wrap.clientHeight - 24;
const intrinsicW = pinCells * engineTILE;
const intrinsicH = pinRows * engineTILE;
const scale = fitToScreen
  ? Math.min(availW / intrinsicW, availH / intrinsicH)
  : 1;
previewCanvas.style.width  = `${intrinsicW * scale}px`;
previewCanvas.style.height = `${intrinsicH * scale}px`;
```

**3.5.c — Play mode, scrolling-window viewport**:

Same scaling math, but `pinCells` = `parsed.meta.viewport.w`, etc.
The visible band fills the wrap; the world inside continues to
scroll behind the camera as before. This is the user's "can the
WINDOW in PLAY mode expand to FIT available space" request.

**Resize handling**: the existing 50ms-debounced `window.resize`
listener calls `applyFitToScreen()` — extend it to also call a new
`applyPlayFitToScreen()` while in play mode.

### 3.6  Minimise the solutions panel (M5)

`src/agentDialog.js`'s success state currently fills the modal with
the solutions list + open trace. v23 adds a `[—]` minimise button
in the dialog header that:

1. Hides the modal backdrop (`.modal-backdrop`'s background → transparent).
2. Collapses the dialog into a thin floating bar pinned to the top
   of the canvas-wrap (overlay layer).
3. Shows: solution-row count, focused-row pills (steps · jumps ·
   pickups), `[Demo]`, `[↕ Expand]`.
4. Trace section + non-focused rows collapse but stay reachable via
   Expand.
5. Path overlay remains visible behind the minimised bar.

Minimised state is REMEMBERED in localStorage so power users who
prefer the overlay-visible view get it persistently.

A `[Close]` button stays in the minimised bar so the user can
dismiss without re-expanding.

### 3.7  Action-graph completeness (M6)

`src/agent/actions.js`'s `enumerateActions(...)` gains three new
edge types. Each integrates with the existing simAction context
(no engine change):

#### 3.7.a  `run_off_platform_then_walk_mid_air`

```js
{ type: 'run_off', dir: 'L'|'R', walkCells: 2..8 }
```

`actionToRecording` emits:
- frames 1..walkCells*8: hold direction key
- continue holding direction until `onGround === true` (sim
  observes — recording emits up to MAX_FRAMES of held-direction)

Edge accepted when end cell is grounded AND the action's parabola
clears ≥ 1 cell of horizontal gap. (Else it's just a longer walk.)

#### 3.7.b  `drop_with_horizontal_carry`

```js
{ type: 'drop_carry', dir: 'L'|'R' }
```

Pre: cell is at the LEFT or RIGHT edge of a grounded platform with
empty space below. Recording: hold direction key from frame 1
until ground touch. Differs from `run_off` because the start is at
the platform EDGE (vx may not yet be at walk-speed); the engine's
acceleration ramps vx during the fall.

#### 3.7.c  `precision_landing`

Not a new action TYPE — a new EVALUATION rule for existing jump
and drop actions. Currently an action's edge is accepted if the
end cell is grounded (cell-resolved). v23 also accepts an edge to
a 1-tile-wide target IF the player's centre-X at the end frame is
within ±2 px of the target's cell centre. The targets are pickup
cells and the exit cell; precision_landing edges are added in
addition to the cell-resolved edges.

This lifts `tutorial.txt`'s `oooo` row: the player drops from the
spawn platform with carry-right; precision_landing identifies that
the parabola passes over cells 8, 9, 10, 11 sequentially; the
agent picks the ordering that catches each.

#### 3.7.d  Action-count budget

Adding ~8 new actions (4 `run_off` per dir × 2 dirs + 1 `drop_carry`
per dir × 2 dirs + 1 fan-out per existing action for precision)
brings the per-cell count to ~36. The graph-build budget grows
~30%; v22's 5s primary budget remains the cap, with the user-
escalation buttons available if the level is genuinely large.

### 3.8  `below_ground.txt` re-investigation

Tied to 3.7's spawn-fall edge cases. After M6 lands, re-run the
agent on `below_ground.txt`; if it still fails, document the
specific failure mode in the v23 transcript and defer to v24.

## 4. UX in detail

### 4.1  Toolbar-pin (no user-visible change except no shift)

Switching to Play mode: canvas stays put, no upward pixel shift.
Switching back: same. Invisible quality improvement.

### 4.2  Play Settings popup with title + HR

```
┌────────────────────────────────────┐
│ Play Settings                      │  ← new title
│ ────────────────────────────────── │  (border-bottom)
│                                    │
│ Viewport:                          │
│   ( ) Fit whole level              │
│   (•) Window:  20 × 12             │
│                                    │
│ ════════════════════════════════   │  ← new HR (accent colour)
│                                    │
│ Pickup-Required:                   │
│   (•) All                          │
│   ( ) N of M:  __                  │
│                                    │
│              [Cancel]  [Save]      │
└────────────────────────────────────┘
```

### 4.3  Light / Dark toggle

```
[Tileset: …][Level: …][Reload][New][Save] [Play Settings][⛶ Fit][🌗][Play][Test]
                                                                  ↑ new
```

Click → flips. The toolbar, panel chrome, legend, and modal
backdrops all re-skin via the CSS-custom-property cascade.

### 4.4  Viewport bounding rectangle

In Design mode for a level with `# viewport: 20x12`:

```
┌─────────────────────────────────────┐
│ ████████████████████████████████████│  ← whole level wider than viewport
│ █  ┌────────────────┐               │
│ █  ┊ viewport rect  ┊  ← dashed     │
│ █  ┊  (yellow, 2px) ┊               │
│ █  ┊       P        ┊  ← spawn      │
│ █  └────────────────┘               │
│ █..............................E...│
│ ████████████████████████████████████│
└─────────────────────────────────────┘
```

### 4.5  Fit-to-screen in Play/Test

Before v23: Test mode → canvas at intrinsic 24-px tiles, wrap
much wider, big empty margin.

After v23: Test mode with Fit-on → canvas scales to fill the wrap;
overlay path remains crisp at any scale (image-rendering: pixelated
is already set).

### 4.6  Minimised solutions panel

Expanded (today, v22):
```
┌───────────────────────────────────────┐
│ ✓ Level completable — 3 solutions     │
│ ┌─────────────────────────────────┐   │
│ │ Solution 1 [steps][jumps][pick] │   │
│ │            [▶ Demo this route]  │   │
│ ├─────────────────────────────────┤   │
│ │ Solution 2 …      [Focus]       │   │
│ └─────────────────────────────────┘   │
│ ▾ Trace — Solution 1 (16 actions)     │
│  …                                    │
│              [Close]                  │
└───────────────────────────────────────┘
        (canvas + overlay HIDDEN)
```

Minimised (new in v23):
```
[ ✓ 3 solutions │ S1: 16 steps · 1 jump · 1 pickup │ ▶ Demo │ ↕ Expand │ × ]
        ↑ floating top bar over the canvas

canvas + overlay VISIBLE — user sees the focused solution's path
```

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/style.css` | `.toolbar { min-height: 38px; align-items: center }`. `.play-settings-header` + `.popup-divider` rules. `body.lightmode { … }` re-binding of `--bg`/`--fg`/`--line`/`--dim`/`--accent`. New `#themeBtn` toolbar-button rule. `.minimised-solutions` floating-bar rule. |
| `src/playSettingsDialog.js` (or inline template) | `<header>` + `<hr>` inserted between Viewport and Pickup-Required blocks. |
| `src/main.js` | Theme state + button + persistence. Edit-mode draw-chain adds `drawViewportGuide()`. `tryPlaytest()` honours `fitToScreen` for both fit-level and scrolling-window viewports. `exitPlaytest()` restores fit. testBtn handler defers `applyFitToScreen()` by one rAF after the dialog opens. |
| `src/agentDialog.js` | `[—]` minimise button → swap dialog template between full and minimised renders. localStorage persistence. |
| `src/agent/actions.js` | `run_off`, `drop_carry` action types added to `enumerateActions`. `actionToRecording` + `actionToWhy` extended. |
| `src/agent/grid.js` | `precision_landing` evaluation rule added to the cell-resolved edge filter — accepts edges that land on a target's cell centre even when the cell-resolved end position differs. |
| `src/agent/grid.test.js` + `actions.test.js` | New unit cases for each new edge type. |
| `tests/v23-toolbar-pin.spec.js` (new) | Playwright: enter/exit Play; the canvas's `getBoundingClientRect().top` differs by ≤ 0 px. |
| `tests/v23-theme.spec.js` (new) | Playwright: click `#themeBtn`; body has `lightmode` class; `getComputedStyle(body).backgroundColor` differs from dark theme. |
| `tests/v23-viewport-guide.spec.js` (new) | Playwright: load a level with `# viewport: 20x12`; sample overlay pixels at the expected dashed-rect bounds; assert non-zero alpha at the edge but zero in the centre. |
| `tests/v23-fit-play.spec.js` (new) | Playwright: turn Fit on in Design; enter Play; canvas's CSS width matches the fit-scaled value. |
| `tests/v23-minimise-solutions.spec.js` (new) | Playwright: click minimise; modal backdrop is dismissed but `.minimised-solutions` floating bar is visible; Demo / Expand / Close all wired. |
| `tests/v23-tutorial-solves.spec.js` (new — acceptance) | Playwright: load `tutorial.txt`; agent returns `.badge.ok` within the 5 s primary budget; ≥ 4 pickup collected in the focused solution's trace. |
| `TDDs/3_transcripts/version23_build.md` (new, M-final) | narrative |

## 6. Open questions — proposed defaults

- **Toolbar `min-height` value (px)**: proposed **38** based on the
  current edit-mode height. Could read at runtime instead; v23 ships
  the static value as the simpler choice.
- **Light theme accent colour**: proposed `#1e7e34`. Could be `#198754`
  or `#198a3e` — bike-shed; ships the proposed value, easy to tweak.
- **Viewport-guide focus cell**: proposed **player spawn cell** as
  the default, falling back to geometric centre when no `P` is set.
  v24+ candidate: follow the most-recently-edited cell.
- **Fit-mode in Play applies UNCONDITIONALLY** when the user has Fit
  on in Design. Alternative: a separate Play-mode fit-mode toggle.
  Proposed: keep one flag — simpler UI, matches user request "use
  the same sizing as in DESIGN mode when FIT is selected".
- **Minimised solutions persistence**: proposed **localStorage**
  per-session. The user might want it remembered globally so power
  users get it automatically — that's the proposed behaviour.
- **`run_off` walk-cells range**: proposed **2..8**. Wider ranges
  blow up the candidate count.
- **Precision-landing tolerance**: proposed **±2 px**. v22 ships
  the cell-resolved check at TILE/2 = 10 px tolerance; ±2 px is the
  tight constraint needed for 1-tile-wide pickups.
- **`tutorial.txt` acceptance**: solves within **5 s** primary
  budget. v22 allowed Try 20s escalation; v23 should hit the
  primary budget so the user doesn't need to escalate.

## 7. Acceptance criteria

### Thread A (UI polish)
- **No tile-shift** when entering / exiting Play (canvas top
  position deviates by ≤ 0 px).
- **Play Settings popup** has a visible title + visible HR between
  Viewport and Pickup-Required blocks.
- **Theme toggle** flips between dark and light; persists.
- **Viewport guide** dashed rectangle appears in Design mode for any
  level with `# viewport: WxH`; absent for `# viewport:` unset.
- **Fit in Play mode** scales the canvas to the available wrap when
  Fit is on; intrinsic 1:1 when Fit is off.
- **Minimise solutions** button collapses the dialog; canvas /
  overlay visible; Demo + Expand + Close work in the minimised bar.

### Thread B (Agent)
- **`tutorial.txt` solves** — `.badge.ok` within 5 s; ≥ 4 pickups
  collected in the focused solution.
- **All v22-passing levels continue to solve** — no regression in
  `simple.txt`, `above_ground.txt`, tower-cherry, the M2/M3 unit
  cases.
- **`below_ground.txt`** — solves if action-graph completeness was
  the root cause; documents the remaining failure if not.

### Tests
- `npm test` green; `npx playwright test` green (existing 31 +
  ≥ 6 new cases).

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Tileset schema** — unchanged (v22.1's `imageLocked` ships as-is).
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **The v18 single-line problems bar / hidden text pane / toolbar
  layout** — unchanged.
- **v22 multi-solution enumeration** — unchanged; the minimise
  affordance is purely presentational.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v24+ candidates / deferred

- **Toolbar-height-pin via runtime measure** — read first paint
  into `--toolbar-h` for sub-pixel-perfect match.
- **Viewport guide follows mouse** — drag-to-pan the guide rectangle.
- **Multi-coloured path overlay** for multi-solution display
  (long-standing).
- **Backtracking around walls** (collect-key-then-return) —
  long-standing.
- **Author-difficulty rating** — composite from solution stats.
- **Web Worker for big-world graph build** — perceived-perf.
- **Multi-level cross-agent** (with future doors / tunnels).
- **Author-resizable legend width** — long-standing.
- **Drag-and-drop legend reorder** — long-standing.
- **Per-tileset legend customisation persistence**.
- **prefers-color-scheme media query** as a first-load theme default.
- **Light-theme path-overlay colours** — the current dark-theme
  reds/blues stay readable on light too; can iterate.

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **Toolbar min-height = 38px assumption**: if the user customises
  fonts or browser-zooms, the natural toolbar height shifts. Mitigation:
  test at 100% / 125% / 150% zoom; document the value as the user's
  default. Runtime-measure fallback in v24.
- **Theme toggle and modal backdrops**: the v22 dialog system uses
  semi-transparent backdrop colours that may not contrast on light.
  Mitigation: re-bind the backdrop colour via a custom property.
- **Viewport guide vs marquee/rect-draw overlay clearing**: the
  overlay canvas is cleared on every reflow + every drag. The guide
  must redraw alongside. Mitigation: integrate into the existing
  reflow chain — same place the marquee paints from.
- **Fit-in-Play scale + the v18 CSS pin**: the v18 hotfix pinned
  canvas width to `pinCells * engineTILE`. v23 scales that — must
  not break the per-frame `editorDraw` ratio (the engine TILE / CSS
  scale is the same, so per-cell rounding is preserved). Mitigation:
  the inline `style.width/height` only affects the CSS-display ratio;
  the canvas's `width`/`height` attributes (intrinsic pixel buffer)
  stay as the launcher set them. Same path the v22 fit-mode uses.
- **Fit-in-Play resize loop**: same risk as v22's wrap-fit. Same
  mitigation: read `clientWidth` (excludes scrollbars); debounced
  `window.resize`.
- **Action enumeration blow-up**: ~28 → ~36 actions = ~30% more
  edges per cell. Per-cell ~50ms sim cost → graph-build time grows
  to ~65 ms × cells. For a 24×14 level (~336 cells, ~50 grounded) =
  ~3.3s — under the 5s primary budget. Mitigation: profile during
  M6; if budget-tight, gate `precision_landing` to cells within K
  tiles of a target (most edges don't need it).
- **`precision_landing` false positives**: a parabola that crosses
  a target's centre-X within ±2 px but ALSO crosses a wall in the
  same frame should not be edge-accepted. Mitigation: re-use the
  existing collision check in simAction — the action only succeeds
  if the simulator says "landed cleanly", which already filters
  wall-crossings.
- **Minimised solutions modal-dismiss semantics**: clicking outside
  the minimised bar must not close the agent flow (the user expects
  the bar to persist while they study the canvas). Mitigation:
  remove the modal-backdrop's `click` handler in minimised mode.
- **`below_ground.txt`** — may not be fixed by M6. Mitigation:
  document the remaining failure mode in the transcript; not a
  hard acceptance criterion (mentioned as "if not, becomes v24
  candidate").
- **No deploy risk** — bundle grows by ~4-6 KB (theme CSS + action
  enumeration code + minimise-solutions renderer).

## 11. Why this scope

The user added five small editor-polish wishlist items after v22
shipped — each is a quick win that improves the daily-use feel of
the editor (no tile-shift, themed UI, viewport visibility, fit
behaviour in all modes, less obscured path overlay). Bundling them
into v23 along with the carry-over agent work mirrors v22's
pattern: small polish + one focused capability uplift.

The action-graph completeness work is the natural successor to
v22's agent thread — the diagnostic chain runs spawn-fall (v22 M1)
→ TSP ordering (v22 M2) → multi-solution (v22 M3) → **action
enumeration** (v23 M6). Without M6, `tutorial.txt` remains the
known-unsolvable shipped level. Landing it in v23 closes the gap
the v22 transcript explicitly named.

The two threads don't share code; the milestone sequence runs UI
polish (M1–M5) FIRST so failure on the agent work doesn't block
the polish shipping, and the polish gives the user a visibly better
editor day-one.
