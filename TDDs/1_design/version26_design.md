# 2D Level Designer — Version 26 Design Document

Status: **Delivered (2026-05-23)** · Builds on:
[version25_design.md](version25_design.md) (sub-pixel edge endpoints +
re-simulate + precision_landing + AudioContext prime) ·
Implementation:
[version26_implementation.md](../2_implementation/version26_implementation.md)
· Transcript:
[version26_build.md](../3_transcripts/version26_build.md)

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `10d5a28` | define :root + body.lightmode CSS custom properties |
| 2 | `b41c58c` | substitute hardcoded dark bgs with vars; delete override blocks |
| 3 | `0a02f47` | fit-to-screen — scale #overlay alongside #preview |
| 4 | `d260489` | sub-pixel state-space A* — node identity (cell, vxBucket) |
| 5 | `f39404f` | acceptance gate — below_ground progress + full agent suite |
| 6 | _this commit_ | acceptance + transcript; design + impl Delivered |

Tests: 295 unit / 95 Playwright pass. Bundle 76.88 kB JS (gzip 26.67 kB),
CSS 15.90 kB (gzip 3.67 kB — down 2.4 kB pre-gzip from v25 thanks to the
deleted override blocks). v9 §7 byte-identical engine invariant preserved
across all six commits.

Carry-over to v27: full `below_ground.txt` solve. vxBucket
discretisation (3 values) is coarser than the sub-pixel state
drift that affects below_ground; the v26 architecture is the
foundation, but v27 needs finer state buckets (e.g. xOffsetBucket
on top of vxBucket) or a per-frame-trajectory planner.

## 1. Purpose

Two threads. One refactor + one user-reported UX bug fix in the
editor; one architectural completion in the agent. Bundle stays
tight (three items total) because the agent thread is risky enough
that piling more polish on top would dilute the testing.

### Thread A — Editor refactor + polish

1. **CSS custom-property refactor.** The v23–v25 lightmode
   patches are the third time we've fixed the same root cause:
   rules with hardcoded `background: #1d1d20 / #2d2d30 / #333` +
   `color: var(--fg)`. The dark-theme assumption only breaks when
   `--fg` flips to dark in `body.lightmode`. Lift those backgrounds
   into custom properties (`--ctl-bg`, `--ctl-hover`, `--input-bg`,
   `--row-hover`, `--focus-tint`, `--focus-border`) defined once at
   `:root` and rebound under `body.lightmode`. Then the override
   comes for free from the cascade — no more specificity foot-guns.

2. **Fit-to-screen draw-tile mismatch fix.** User-reported: when
   Fit-to-screen is active in design mode, clicking on the canvas
   to draw a tile changes the WRONG cell — the editor's pointer-
   to-cell mapping uses the intrinsic-pixel canvas size, but the
   user sees a CSS-scaled canvas. Click coordinates need to be
   inverse-scaled before grid-cell rounding.

### Thread B — Agent architectural completion

3. **Sub-pixel state-space A\* (3.1.b from v25 §3.1).** The
   carry-over from v25 M3: A* searches over the cell-resolved
   graph but the actual physics moves the player by sub-pixel
   amounts; multi-step plans drift enough that `below_ground.txt`'s
   final jump misses the row-5 platform. Replace the cell-keyed
   node identity with a richer `(cell, vx-bucket, vy-bucket)` key
   so the search can distinguish "(7, 21) standing still" from
   "(7, 21) with leftward momentum". Edges are still built by
   simAction; A* explores the richer node space.

   **Acceptance**: `below_ground.txt` solves end-to-end (full 16
   pickups + exit, within 5 s).

### Out of scope (proposed deferrals)

- **"Top messages row" feature** (new v25 wishlist item) — a
  decoration/HUD row at the top of every level. Touches level
  format, renderer, player physics, scoring HUD. Big enough to
  warrant its own version. v27+ candidate.
- **Double-jump engine extension** — would break v9 §7. Still
  in the wishlist; needs explicit user approval.
- **Reactive theme listener** (OS-pref flips mid-session) —
  small, but no signal demanding it.
- **Long-standing legend / minimap / linked-levels / slopes**
  wishlist items — too big for v26's two-thread bundle.

## 2. Current state

### CSS theming (v23 M2 + v23–v25 patches)

- `:root` defines `--bg`, `--fg`, `--line`, `--dim`, `--accent`,
  plus `--panel`, `--guide`, `--err`, `--warn`, `--mono`, `--fs`,
  `--lh`. `body.lightmode` rebinds the first six.
- BUT most buttons, inputs, hovers use hardcoded backgrounds
  (`#1d1d20`, `#2d2d30`, `#333`, `#3d3d40`) instead of custom
  properties. Each light-mode regression has needed a fresh
  override block at matching specificity.
- The v23–v25 lightmode override blocks are ~80 lines that wouldn't
  exist if the underlying rules used `var(--ctl-bg)` etc.

### Editor (v23 M4 + v25)

- `applyFitToScreen()` sets `previewCanvas.style.width/height`
  inline when fit is on. The canvas's intrinsic `width` /
  `height` attributes stay at `gridW * TILE` (editor TILE = 24).
- Pointer-to-cell mapping in `cellFromEvent` reads
  `overlay.getBoundingClientRect()` and divides by the **intrinsic
  canvas size** — but the overlay is CSS-scaled in fit mode, so
  the rect is the CSS-scaled size. The intrinsic / CSS-display
  ratio is mismatched → clicks land at the wrong cell.

### Agent (v25)

- Action enumeration: 46 candidates per grounded cell.
- Edges carry `endState` (sub-pixel + velocity + onGround).
- Planner re-simulates each step from `prevEndState` and emits
  mid-arc direction releases (v25 M2).
- `precision_landing` rule emits extra edges for ±2 px target
  passes (v25 M4).
- **A\* still searches over a cell-resolved graph.** For
  `below_ground`'s final jump (from sub-pixel (7, 21.4) → expected
  (5, 23) but lands at (7, 22)), A* can't model the sub-pixel
  start, so it picks an edge that fails in practice.

## 3. Architecture

### 3.1  CSS custom-property refactor

Two-step migration to keep the diff reviewable and the risk low:

**Step A — Define new variables.** Add to `:root`:

```css
--ctl-bg:        #333;       /* button background (toolbar + dialog) */
--ctl-hover:     #3d3d40;    /* hover state */
--input-bg:      #1d1d20;    /* textarea / select / number-input */
--row-hover:     #2d2d30;    /* row-level hover (lv-pick, problems) */
--focus-tint:    #1e3b29;    /* focused-row green tint */
--focus-border:  #6cd99a;    /* focused-row border + accent */
--badge-ok-bg:   #1e3b29;
--badge-ok-fg:   #6cd99a;
--badge-fail-bg: #3b1e1e;
--badge-fail-fg: #ff8c8c;
--badge-search-bg: #2a2d3a;
--badge-search-fg: #c8c8e0;
```

Rebind under `body.lightmode`:

```css
body.lightmode {
  --ctl-bg:        #e0e0e0;
  --ctl-hover:     #d2d2d2;
  --input-bg:      #ffffff;
  --row-hover:     #ececec;
  --focus-tint:    #d8f0e0;
  --focus-border:  #1e7e34;
  --badge-ok-bg:   #d8f0e0;
  --badge-ok-fg:   #1e7e34;
  --badge-fail-bg: #f2d0d0;
  --badge-fail-fg: #b22222;
  --badge-search-bg: #fff3cd;
  --badge-search-fg: #856404;
}
```

**Step B — Substitute the hardcoded values.** Every `background:
#1d1d20` → `background: var(--input-bg)`. Every `background: #333`
→ `background: var(--ctl-bg)`. Etc. Do it per-rule with `git
diff` review.

**Step C — Delete the v23–v25 lightmode override blocks.** Once
all underlying rules use custom properties, the explicit
`body.lightmode .stat-pill { background: ... }` blocks are
redundant — the cascade does it.

The migration is BREAKABLE if not done carefully: each rule's old
value must match the var's dark value EXACTLY. Mitigation:
sweep + grep test (assert no `#1d1d20` / `#2d2d30` / `#333` left
in `src/style.css` after the refactor).

### 3.2  Fit-to-screen draw-tile mismatch

Current `cellFromEvent(e)` (in `src/main.js`):

```js
const r = overlay.getBoundingClientRect();
const gx = ((e.clientX - r.left) * (overlay.width / r.width)) / TILE;
const gy = ((e.clientY - r.top) * (overlay.height / r.height)) / TILE;
```

The `overlay.width / r.width` ratio CORRECTLY inverts the CSS
scaling — `overlay.width` is the intrinsic-pixel buffer width,
`r.width` is the CSS-displayed width. So this should ALREADY
work in fit mode...

Need to investigate. Two hypotheses:

- **a)** the math is right but the overlay's intrinsic dims are
  out of sync with the preview canvas's intrinsic dims when fit
  is toggled. The `applyFitToScreen()` only resizes the preview
  canvas, not the overlay; if their intrinsic sizes differ the
  overlay's pointer-to-cell math goes wrong.

- **b)** `applyFitToScreen()` sets CSS width/height with
  `Math.floor` which loses sub-pixel precision. The browser's
  `getBoundingClientRect().width` may differ from
  `parseFloat(style.width)` by ≤ 1 px, biasing the click
  coordinate.

Plan: probe with `performance.now()` + DOM inspection. Add the
overlay to `applyFitToScreen()` so both canvases get the same CSS
scale. Hypothesis (a) covers the most likely cause.

### 3.3  Sub-pixel state-space A*

The fundamental fix v25 deferred. Instead of A* nodes being
`cellKey(r, c)`, they become `stateKey(r, c, vxBucket, vyBucket)`
— or more practically `cellKey(r, c) + sub-bucket`.

**Bucket discretisation**:
- `vxBucket`: -1 (moving left, vx ≈ -SPEED), 0 (still, vx ≈ 0),
  +1 (moving right, vx ≈ +SPEED).
- `vyBucket`: only matters mid-air; for grounded cells (A*
  start states) it's always 0.

So a grounded cell expands to **3 nodes** (one per vxBucket)
instead of 1. Graph node count triples; edges per node stays the
same (~46 actions). A* memory ~3x; search time potentially
worse (richer state space) but the heuristic helps prune.

**Edge enumeration**: `addActionEdges` runs each action from
each (cell, vxBucket) combination, simulating with the
corresponding initial `vx` value. The result's `endState`
determines which (cell, vxBucket) bucket the edge lands in.

**A\* search**: start state = `(start.r, start.c, vxBucket=0)`.
Goal states = `(goal.r, goal.c, *)` (any vxBucket — we don't care
how we arrive). For pickups + exit, accept the first goal-cell
match regardless of vx.

**Recording emission**: as in v25, the planner re-simulates each
step from prev endState. With the richer node identity, the
build-time edge's start state MATCHES the actual prev endState's
bucket → re-simulation produces the same trajectory → cell
expectation holds.

**Risk**: 3x graph size + larger search tree could blow the 5 s
budget on big levels. Mitigation: the heuristic still uses
cell-Manhattan-distance; bucket-aware nodes only add candidate
diversity, not heuristic confusion. Profile during M3; if
budget-tight, reduce vxBucket to 2 (still vs moving-any-dir) or
prune by reachability.

**Acceptance**: `below_ground.txt` returns `.badge.ok` within 5 s.
`above_ground`, `tutorial`, `simple`, tower-cherry all continue
to solve.

## 4. UX in detail

### 4.1  CSS refactor (invisible)

The user sees zero change — both themes look identical pre/post.
The benefit is future maintenance: lightmode bugs don't recur
because the override path is now structural (cascade) instead of
ad-hoc.

### 4.2  Fit-to-screen draw-tile fix

Click-and-drag on the canvas with Fit on changes the cells the
user IS LOOKING AT (was: changes neighbour cells offset by the
CSS scale ratio). Tile-painting feels correct again.

### 4.3  below_ground.txt solves

The agent's Test flow now reports `✓ Level completable — N
solutions` on below_ground. Path overlay traces the whole route
through both ooo platforms to the exit.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/style.css` | New `:root` custom properties + `body.lightmode` rebinds. Substitute hardcoded `#1d1d20 / #2d2d30 / #333` etc. with `var(--…)` per-rule. Delete the v23–v25 lightmode override blocks once redundant. |
| `src/main.js` | `applyFitToScreen()` also scales the `#overlay` canvas to match the `#preview` (same `style.width/height`). `cellFromEvent` math is unchanged — once the overlay matches the preview, the existing ratio inversion works. |
| `src/agent/grid.js` | Node identity changes from `cellKey(r, c)` to `stateKey(r, c, vxBucket)` (vxBucket ∈ {-1, 0, +1}). Edge enumeration runs each action from each (cell, vxBucket). |
| `src/agent/planner.js` | A* operates on the richer state keys. Start state = (spawn-cell, vx=0). Goal acceptance: any vxBucket. Re-simulation in `emitLegInputs` matches the build-time bucket. |
| `tests/v26-css-refactor.spec.js` (new) | Asserts no hardcoded `#1d1d20 / #2d2d30 / #333` remain in `src/style.css`; lightmode-popups suite continues to pass (validation that the cascade-only override path works). |
| `tests/v26-fit-draw.spec.js` (new) | Turn Fit on; click at a known canvas position; assert the cell that flips matches the visible cell at that screen position. |
| `tests/v26-below-ground-solves.spec.js` (new) | The acceptance gate from v25 M3, now with full solve. Replaces the v25-below-ground-solves.spec.js's "progress" assertion. |
| `tests/agent-test-button.spec.js` etc. | All v21–v25 cases continue to pass. |
| `TDDs/3_transcripts/version26_build.md` (new, M-final) | narrative |

## 6. Open questions — proposed defaults

- **CSS refactor scope**: full sweep (every `#1d1d20 / #2d2d30 /
  #333` lifted), or partial (just buttons + inputs)? Proposed:
  **full sweep** — the value is in eliminating the override-block
  cycle entirely.
- **Bucket count for sub-pixel A***: vxBucket ∈ {-1, 0, +1}
  (proposed). Finer buckets (e.g. {-1, -0.5, 0, +0.5, +1})
  multiply graph size; coarser doesn't fix below_ground. **3
  buckets is the minimal viable resolution.**
- **A\* heuristic**: same Manhattan-cell × walk-cost as v21.
  Bucket-aware nodes don't change reachability bounds.
- **Performance budget**: if v26 M3 exceeds the 5 s primary
  budget on a real level, reduce vxBucket to 2 (still vs
  moving-any-dir). If still tight, prune by "can we even reach
  this bucket from the current state?".
- **Fit-to-screen overlay sync**: scale the `#overlay` to match
  `#preview` in `applyFitToScreen()`. This is the simplest fix
  and doesn't change the cellFromEvent math.

## 7. Acceptance criteria

### Refactor
- **No hardcoded dark backgrounds** in `src/style.css` after the
  sweep (`grep -E '#(1|2|3)[0-9a-fA-F]' src/style.css` returns
  only var-rebinding lines in `:root` and `body.lightmode`).
- **All v23–v25 lightmode override blocks deleted**.
- **Visual parity**: both themes render identically pre/post via
  the existing tileset-screenshots and lightmode-popups specs.

### Fit-to-screen
- **Click-to-paint matches the visible cell** when Fit is on.
  Drawing a 5×5 block at a screen position produces a 5×5 block
  AT THAT screen position (not offset).

### Agent
- **`below_ground.txt` solves** — `.badge.ok` within 5 s.
- **`above_ground.txt`, `tutorial.txt`, `simple.txt`, tower-cherry
  continue to solve** — no regression.
- **Graph-build time** stays under 1 s on the shipped levels.

### Tests
- `npm test` green; `npx playwright test` green (existing 81 +
  ≥ 5 new cases).

## 8. Non-impact (explicit)

- **Tileset schema** — unchanged.
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **Level format glyphs + directives** — unchanged.
- **v18+ toolbar / problems bar / legend layout** — unchanged.
- **v22 multi-solution + v23 minimise + v24 multi-colour + v25
  pre-warmed AudioContext** — unchanged.
- **The LOAD / theme / fit-toggle flows** — unchanged; fit-mode
  draw-fix is internal to `applyFitToScreen` + the overlay scale.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v27+ candidates / deferred

- **"Top messages row" feature** — decoration row at the top of
  every level for score / messages. Touches level format,
  renderer, player physics, scoring HUD. v27 candidate.
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval.
- **Reactive theme listener** — respond to OS-pref flips
  mid-session.
- **Viewport guide follows mouse** — drag-to-pan the v23 guide.
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

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **CSS refactor breaks visual parity** — a missed
  `#1d1d20 → var(--input-bg)` substitution leaves the rule in
  dark mode under both themes. Mitigation: existing
  `tests/v23-theme.spec.js` + `tests/v25-lightmode-popups.spec.js`
  catch every previously-broken popup; new
  `tests/v26-css-refactor.spec.js` greps for residual
  hardcoded dark hex values.
- **Sub-pixel A\* graph 3x growth** — search time could blow the
  5 s budget on big levels. Mitigation: profile at M3 gate.
  Reduce vxBucket count or prune unreachable nodes if needed.
- **Sub-pixel A\* breaks existing solves** — the v22 TSP-optimal
  + v23 multi-solution + v25 re-simulation chains all assumed
  cell-keyed nodes. Mitigation: each test in the agent suite is
  the gate; if a level regresses, the bucket-aware planner needs
  another tweak.
- **Fit-to-screen overlay sync edge case** — if the overlay
  matches the preview's intrinsic dims but the preview was
  resized between fit-on and the next click, `cellFromEvent`
  could read a stale intrinsic size. Mitigation: scale the
  overlay synchronously inside `applyFitToScreen()`; the next
  paint also calls it.
- **No deploy risk** — bundle grows by ~1-2 KB (CSS var defs
  add boilerplate; the override blocks they replace are
  comparable size; net zero or slightly smaller).

## 11. Why this scope

v25 explicitly named 3.1.b as the v26 starting point. The CSS
refactor is the user's response to having patched the same
specificity bug three commits in a row — a structural fix that
prevents recurrence. The fit-to-screen draw mismatch is a
small UX bug the user reported alongside; quick to fix, fits
the M1–M2 commit window.

The big-ticket future items (top messages row, slopes, multi-
level linking, AI level designer) stay in the v27+ candidate
pool. v26 closes the v22–v25 agent-architectural thread; v27+
can start a new feature push.
