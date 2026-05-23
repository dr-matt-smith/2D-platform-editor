# Version 26 — Implementation Plan

Status: Proposed · Date: 2026-05-23 · Design:
[../1_design/version26_design.md](../1_design/version26_design.md)

Six small path-scoped commits. The CSS refactor is split into two
milestones (define-then-substitute) to keep the diff reviewable and
allow rollback. The agent thread (M4–M5) lands as the larger,
acceptance-gated change.

## Process (same discipline as v8–v25)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/` / tileset `src.txt` / `sources.txt`
  files stay out.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v26 only touches editor
  modules (`main.js`, `style.css`) and `src/agent/*`.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - M1 (CSS vars defined) changes nothing visually — adds custom
    properties but doesn't rebind existing rules. Pre/post screenshot
    identical via the tileset-screenshots suite.
  - M2 (substitute) — each replaced rule's old colour must match the
    var's dark value EXACTLY. The v25-lightmode-popups suite catches
    regressions; new M2 grep-test catches missed substitutions.
  - M3 fit-draw fix — pointer-to-cell math stays the same; only the
    overlay canvas's CSS scale changes to match the preview. Off-mode
    (Fit not on) byte-identical to v25.
  - M4 sub-pixel A* — node-identity change is the riskiest. Mitigation:
    full agent-suite Playwright pass at the M5 gate.
- **CSS refactor scope-cap**: full sweep (every `#1d1d20 / #2d2d30 /
  #333 / #3d3d40` hex constant moves to a var) — the value is in
  eliminating the patch cycle entirely.
- **Sub-pixel bucket discretisation**: vxBucket ∈ {-1, 0, +1} (3
  values). vyBucket omitted because grounded-cell start states are
  always vy = 0. Graph node count grows 3x; profile during M4.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/style.css` | New `:root` custom properties (`--ctl-bg`, `--ctl-hover`, `--input-bg`, `--row-hover`, `--focus-tint`, `--focus-border`, `--badge-ok-bg`, `--badge-ok-fg`, `--badge-fail-bg`, `--badge-fail-fg`, `--badge-search-bg`, `--badge-search-fg`); `body.lightmode` rebinds them. No existing rule changes yet | M1 |
| `tests/v26-css-vars.spec.js` (new) | Asserts the new variables resolve to the expected dark / light values via `getComputedStyle(document.documentElement).getPropertyValue(...)`. Passes pre/post visual parity check | M1 |
| `src/style.css` | Substitute hardcoded `#1d1d20 → var(--input-bg)`, `#333 → var(--ctl-bg)`, `#3d3d40 → var(--ctl-hover)`, `#2d2d30 → var(--row-hover)`, etc. across every rule. Delete the v23-v25 `body.lightmode #fooBtn { background: ... }` override blocks (cascade now handles them) | M2 |
| `tests/v26-css-refactor.spec.js` (new) | Greps the BUILT `dist/assets/index-*.css` for residual `#1d1d20` / `#2d2d30` / `#333` etc. — asserts none remain outside of the `:root` / `body.lightmode` var-binding blocks. Plus visual-parity check (computed backgrounds match v25 values in both themes) | M2 |
| `src/main.js` | `applyFitToScreen()` ALSO scales the `#overlay` canvas to match `#preview`'s inline width/height. The existing `cellFromEvent` ratio inversion math is unchanged | M3 |
| `tests/v26-fit-draw.spec.js` (new) | Turn Fit on; pointer-click at a known canvas position; assert the cell that flips matches the visible cell under that screen position (±1 cell tolerance for sub-pixel rounding) | M3 |
| `src/agent/grid.js` | Node identity changes from `cellKey(r, c)` to `stateKey(r, c, vxBucket)` where `vxBucket ∈ {-1, 0, +1}`. `addActionEdges` runs each action from each (cell, vxBucket) start state. Edge `to` uses the destination's stateKey | M4 |
| `src/agent/planner.js` | A* operates on stateKey nodes. Start state = `stateKey(spawn, 0)`. Goal acceptance: match by `cellKey` regardless of vxBucket (any-vx pickup or exit win). Heuristic stays Manhattan-cell × walk-cost (vx-agnostic) | M4 |
| `tests/v26-bucket-graph.spec.js` (new) | Asserts the nav-graph for a simple level has ≥ N expected stateKey nodes (= cell-count × 3 minus impossible vx combinations); A* finds a path through different vxBucket states on a level where momentum matters | M4 |
| `tests/v26-below-ground-solves.spec.js` (new) | The acceptance gate from v25 M3 carried forward — now expecting `.badge.ok` within 5 s. Replaces the v25-below-ground-solves.spec.js's PROGRESS assertion | M5 |
| Existing agent suite | All v21–v25 cases continue to pass — no regression | M5 gate |
| `TDDs/3_transcripts/version26_build.md` (new) | narrative covering each milestone | M6 |

## Milestone 1 — CSS custom properties defined

Pure refactor, no behaviour change. Sets up the cascade infrastructure
M2 will plug into.

1. `src/style.css`:
   - Extend the `:root` block with the dark-mode values:
     ```css
     --ctl-bg:        #333;
     --ctl-hover:     #3d3d40;
     --input-bg:      #1d1d20;
     --row-hover:     #2d2d30;
     --focus-tint:    #1e3b29;
     --focus-border:  #6cd99a;
     --badge-ok-bg:   #1e3b29;
     --badge-ok-fg:   #6cd99a;
     --badge-fail-bg: #3b1e1e;
     --badge-fail-fg: #ff8c8c;
     --badge-search-bg: #2a2d3a;
     --badge-search-fg: #c8c8e0;
     ```
   - Extend the `body.lightmode` block with the light-mode rebinds:
     ```css
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
     ```
2. `tests/v26-css-vars.spec.js`:
   - Page goto + dark mode default: assert `--input-bg` resolves to
     `#1d1d20` etc.
   - Click theme toggle: assert `--input-bg` resolves to `#ffffff` etc.
3. **Visible after this commit**: no user-visible change. Tile-set
   screenshots + lightmode-popups specs continue to pass.

Commit: `v26 m1: define :root + body.lightmode custom properties for control bgs`.

## Milestone 2 — Substitute hardcoded values + delete override blocks

The actual refactor. Each rule's old colour must match the var's
dark value EXACTLY (M1 chose the var values to match the existing
hardcoded ones — so substitution is mechanical).

1. `src/style.css`:
   - Across every rule, replace:
     - `background: #333` → `background: var(--ctl-bg)`
     - `background: #3d3d40` → `background: var(--ctl-hover)`
     - `background: #1d1d20` → `background: var(--input-bg)`
     - `background: #2d2d30` → `background: var(--row-hover)`
     - `background: #1e3b29` → `background: var(--focus-tint)` (where
       used as a "focused row" tint — leaves the v22 `#fitBtn.active`
       intact since that's its own accent variant)
     - `background: #2a2a2a` → `background: var(--ctl-bg)` (the legend-
       glyph slightly-different shade is harmless to fold into ctl-bg)
     - `border-color: #6cd99a` (focused state) → `var(--focus-border)`
     - `.agent-dialog .badge.ok / .fail / .searching` use the badge
       vars too
   - Delete the v23-v25 `body.lightmode #fooBtn { background: ... }`
     override blocks now that the cascade handles them:
     - `body.lightmode #newBtn / #dlBtn / #playBtn / #playSettingsBtn /
       #testBtn / #fitBtn / #restartBtn / #exitBtn / .cf-btn /
       .legend .glyph / .legend .legend-toggle` overrides
     - `body.lightmode #tilesetSel / #levelSel` overrides
     - `body.lightmode .play-settings #ps-n / #ps-vw / #ps-vh` overrides
     - `body.lightmode .paste-load-dialog .pl-text / #pl-name` overrides
     - `body.lightmode .agent-dialog .stat-pill / .countdown /
       .solution-row / .trace*` overrides
     - `body.lightmode .agent-dialog .badge.ok / .fail / .searching`
       overrides (the new `--badge-*-bg / --badge-*-fg` vars replace
       them)
     - `body.lightmode .nv-form select / .nv-form input` overrides
     - `body.lightmode .lv-pick:hover / .lv-dl / .lv-new` overrides
     - `body.lightmode .cf-btn.primary` override
     - `body.lightmode #themeBtn` overrides (keep the icon-button
       shape; bg via cascade)
2. `tests/v26-css-refactor.spec.js`:
   - Greps the BUILT `dist/assets/index-*.css` for residual hardcoded
     dark hex values. Allowed locations: inside the `:root { ... }`
     block and the `body.lightmode { ... }` block (where vars are
     defined / rebound). Anywhere else = a missed substitution.
   - Visual-parity sanity: load the editor in dark mode, sample
     `getComputedStyle` of a button + a stat-pill + a focused row;
     assert RGB matches the pre-refactor values within ±2 per channel.
   - Switch to light mode; assert RGB matches the v25 light values.
3. Re-run the v23-theme + v25-lightmode-popups suites — must all pass
   under the cascade-only override path.
4. **Visible after this commit**: no user-visible change (both themes
   look identical). Code base is leaner; future light-mode bugs of
   this class can't recur.

Commit: `v26 m2: substitute hardcoded dark bgs with custom properties; delete override blocks`.

## Milestone 3 — Fit-to-screen draw-tile mismatch fix

1. `src/main.js`:
   - In `applyFitToScreen()`, when setting `previewCanvas.style.width`
     + `style.height`, ALSO set the same values on `overlay`:
     ```js
     previewCanvas.style.width  = `${cssW}px`;
     previewCanvas.style.height = `${cssH}px`;
     overlay.style.width  = `${cssW}px`;
     overlay.style.height = `${cssH}px`;
     ```
   - When fit is OFF, both canvases get cleared inline styles
     (existing behaviour for `previewCanvas`; extend to `overlay`):
     ```js
     previewCanvas.style.width = '';
     previewCanvas.style.height = '';
     overlay.style.width = '';
     overlay.style.height = '';
     ```
   - `cellFromEvent` math is unchanged — once the overlay matches the
     preview, the existing `overlay.width / r.width` ratio inversion
     reads correct intrinsic-vs-display dims.
2. `tests/v26-fit-draw.spec.js`:
   - Load a small level (10x6 say).
   - Turn Fit on; wait for the scale to apply.
   - Click at a known SCREEN position over the canvas.
   - Inspect the buffer's text — assert the cell that flipped
     (background → user's active glyph) corresponds to the cell
     visible at that screen position (use the same ratio math the
     editor uses to compute the expected cell).
   - Tolerance: ±1 cell (sub-pixel rounding on Math.floor).
3. **Visible after this commit**: tile-painting in Fit mode hits the
   cells the user IS LOOKING AT. Drawing a 5×5 rectangle at a screen
   position produces a 5×5 block AT that position (was: offset).

Commit: `v26 m3: fit-to-screen — scale overlay alongside preview so click coordinates match`.

## Milestone 4 — Sub-pixel state-space A*

The architectural completion. Riskiest milestone — re-validate the
full agent suite at the M5 gate.

1. `src/agent/grid.js`:
   - Introduce the bucket discretisation:
     ```js
     const VX_BUCKETS = [-1, 0, +1];
     const bucketOfVx = (vx) =>
       Math.abs(vx) < 30 ? 0 : (vx < 0 ? -1 : +1);
     export const stateKey = (r, c, vxBucket) => `${r},${c},${vxBucket}`;
     ```
   - `buildNavGraph`:
     - Nodes: for each walkable cell, emit one node per vxBucket
       (3 nodes per cell). Grounded check stays the same; only
       grounded cells emit OUTGOING edges (vx-bucket variants
       start grounded for jumps/walks).
     - Edges: `addActionEdges(ctx, parsed, node, edgesArr, exitCells,
       precisionTargets)` runs each action from a startState whose
       `vx` matches `node.vxBucket * SPEED`. Result's `endState.vx`
       determines the destination's bucket.
   - Edge construction stores `to: stateKey(targetR, targetC,
     bucketOfVx(result.endState.vx))`.
2. `src/agent/planner.js`:
   - A* keys nodes by stateKey. Start = `stateKey(spawn.r, spawn.c, 0)`.
   - Goal-cell matching: a node matches a goal when its `cellKey`
     part (`r,c`) matches the goal's `r,c`, regardless of vxBucket.
     Implementation: when reconstructing the path, iterate goal-
     matching nodes and pick the lowest-cost one.
   - Heuristic: still Manhattan-cell × walk-cost (vx-agnostic). The
     bucket distinction affects edge traversal cost (some edges only
     work from specific vx buckets), not the heuristic estimate.
3. `tests/v26-bucket-graph.spec.js`:
   - Build the nav-graph for a simple level. Assert nodes.size
     ≈ walkable-cells × 3 (minus impossible-vx-state nodes).
   - Construct a level where a pickup is only reachable via a
     jump from a moving-right state (run-up jump). A* must find
     this path.
4. Re-run the full agent suite at the M5 gate — but here in M4 we
   should also run it for spot-checks:
   - `simple.txt`: solves
   - `above_ground.txt`: solves
   - `tutorial.txt`: solves (with 4 pickups)
   - tower-cherry: solves
   - `below_ground.txt`: SHOULD solve (the v26 acceptance)
5. **Visible after this commit**: `below_ground.txt` solves; other
   levels continue to solve.

Commit: `v26 m4: sub-pixel state-space A* — node identity (cell, vxBucket)`.

## Milestone 5 — Below_ground acceptance + agent-suite regression gate

1. `tests/v26-below-ground-solves.spec.js`:
   - Load `below_ground.txt`; click Test; expect `.badge.ok`
     within 5 s.
   - Assert focused-solution stat pills include 16 pickups (all of
     them collected).
2. Delete `tests/v25-below-ground-solves.spec.js` — its PROGRESS
   assertion is superseded by the full-solve assertion here.
3. Full agent-suite Playwright pass:
   - `tests/agent-test-button.spec.js` (v21 cases)
   - `tests/v22-acceptance.spec.js`
   - `tests/v23-action-graph.spec.js`
   - `tests/v24-*.spec.js`
   - `tests/v25-*.spec.js`
   - `tests/v26-bucket-graph.spec.js`
4. **Visible after this commit**: every shipped level the agent can
   theoretically solve now reports `.badge.ok`. The v22 multi-
   solution dialog renders the new bucket-aware paths the same way
   it rendered cell-resolved ones — UX unchanged.

Commit: `v26 m5: below_ground.txt solves under sub-pixel A*; full agent-suite regression gate`.

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `tests/v26-acceptance.spec.js` (optional cross-cutting case):
   - e.g. "lightmode + below_ground solves + path overlay renders".
2. `TDDs/3_transcripts/version26_build.md`: narrative covering:
   - The CSS refactor (define → substitute → delete blocks) and
     the patterns it eliminates.
   - The fit-to-screen draw fix (one-line root cause: overlay
     wasn't being scaled alongside preview).
   - The sub-pixel A* (bucket discretisation, graph 3x size,
     where the acceptance landed).
3. Mark design + impl Delivered with the M1–M6 commit-hash table.

Commit: `v26 m6: acceptance + v26 transcript; design + impl Delivered`.

## Risks & sequencing

- **M2 missed substitution** — one `#1d1d20` left in a rule means
  that rule stays dark in light mode. Mitigation: the new
  `tests/v26-css-refactor.spec.js` greps the built CSS for residual
  hex values outside the var-defining blocks.
- **M2 over-substitution** — folding `#2a2a2a` (legend-glyph shade)
  into `var(--ctl-bg)` slightly changes its appearance from very-
  dark-grey to medium-dark-grey. Acceptable change (the difference
  was hardly visible anyway) but called out in the commit message.
- **M3 fit-draw edge case** — if the overlay's intrinsic dims also
  change (they shouldn't), the cellFromEvent math could need
  adjustment. Mitigation: the existing ratio math is dimensionally
  correct; only the CSS scale needs alignment.
- **M4 graph 3x growth** — could blow the 5 s budget on big levels.
  Mitigation: profile at M4. If tight, reduce vxBucket to 2 (still
  vs moving-any-dir) or prune unreachable bucket states.
- **M4 existing-level regression** — the cell-resolved graph that
  v22-v25 solved against changes shape. Mitigation: full agent-suite
  Playwright pass at the M5 gate. If a level regresses, the bucket
  discretisation may need refinement.
- **M5 below_ground doesn't fully solve** — if M4's bucket-aware A*
  STILL can't find a path, the issue is deeper than vx state and
  v26 needs to ship as partial-progress + document for v27. Less
  likely than the v25-similar case because A* now sees the actual
  states the engine produces, not cell-pixel approximations.
- **No deploy risk** — bundle size grows ~1 KB (CSS vars boilerplate)
  net of the deleted override blocks; JS grows ~1 KB (bucket key
  construction). Same order as v22-v25.

## Deferred (design §9 → v27+)

- **"Top messages row" feature** — new v25 wishlist item. Touches
  level format / renderer / player physics / HUD; needs its own
  design pass.
- **Double-jump engine extension** — would break v9 §7 invariant;
  needs explicit user approval.
- **Reactive theme listener** — respond to OS-pref flips mid-session.
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

Plus the long-standing v16/v17/v18/v19 carry-overs.
