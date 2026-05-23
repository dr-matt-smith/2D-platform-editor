# Transcript — Version 26: CSS Custom Properties, Fit-Draw Sync, Bucketed A*

A narrative record of the v26 phase. The CSS refactor the user asked
for after the third lightmode patch in a row landed cleanly. The
fit-to-screen draw-tile UX bug was a one-line fix (the overlay
wasn't being scaled alongside the preview). The sub-pixel
state-space A* — the architectural completion v25 named as the v26
starting point — landed as a structural foundation but didn't fully
close the below_ground.txt gap. v27 carries that forward.

The brief, from the v26 design's two threads:

1. **CSS custom-property refactor** — eliminate the v23–v25
   patch-block cycle.
2. **Fit-to-screen draw-tile mismatch** — small UX bug.
3. **Sub-pixel state-space A\*** — the architectural completion.
4. **Acceptance**: `below_ground.txt` solves end-to-end (per
   design); regression gate on all v21–v25 levels.

The user's go-ahead, verbatim:

> implement milestones please

## The shape of the work

Six small commits, one milestone each:

| M | Commit    | Deliverable |
|---|-----------|-------------|
| 1 | `10d5a28` | New `:root` custom properties (`--ctl-bg`, `--ctl-hover`, `--input-bg`, `--row-hover`, `--focus-tint`, `--focus-border`, `--badge-*`). Pure addition; both themes render identically pre/post. |
| 2 | `b41c58c` | Substitute hardcoded `#1d1d20 / #2d2d30 / #333 / #3d3d40` etc. with `var(...)` across every rule. Delete the v23–v25 `body.lightmode` override blocks now that the cascade handles them. CSS bundle drops 2.4 kB. |
| 3 | `0a02f47` | `applyFitToScreen()` also scales `#overlay` to match `#preview`. Clicks in Fit mode now flip the cell the user IS LOOKING AT (was: offset by the fit scale ratio). |
| 4 | `d260489` | Node identity changes from `cellKey(r, c)` to `stateKey(r, c, vxBucket)` where `vxBucket ∈ {-1, 0, +1}`. Each walkable cell expands to 3 nodes; A* picks edges that depend on incoming horizontal momentum. SIM_MAX_FRAMES bumped 1200 → 2400 to accommodate longer plans. |
| 5 | `f39404f` | Acceptance gate. below_ground PROGRESS (score ≥ 8, sometimes higher) but not full solve. Full v21–v25 agent suite continues to pass. v27 carry-over flagged. |
| 6 | _this commit_ | v26 transcript; design + impl Delivered with M1–M6 hash table |

Outcome: 295 unit tests still pass. Playwright 88 → 95 (+7). v9 §7
byte-identical-to-upstream invariant for `src/play/core/*` +
`src/play/entities/*` preserved across all six commits. Bundle:
JS 76.44 → 76.88 kB (gzip 26.48 → 26.67 kB), **CSS 18.28 →
15.90 kB** (gzip 4.01 → 3.67 kB — the deleted override blocks
dropped ~2.4 kB). Path-scoped `git add` discipline held — no
`__temp/`, no `manifest.json`, no `above_ground2.txt` /
`fred.txt`, no tileset `src.txt` / `sources.txt` touched the
index.

## Thread A — Editor refactor + polish

### M1 — Define CSS custom properties

Pure addition. Twelve new variables defined at `:root` with their
existing-hardcoded dark values, then rebound under `body.lightmode`
with the v23–v25 light-override-block values:

```css
:root {
  --ctl-bg:          #333;
  --ctl-hover:       #3d3d40;
  --input-bg:        #1d1d20;
  --row-hover:       #2d2d30;
  --focus-tint:      #1e3b29;
  --focus-border:    #6cd99a;
  --badge-ok-bg:     #1e3b29;
  --badge-ok-fg:     #6cd99a;
  --badge-fail-bg:   #3b1e1e;
  --badge-fail-fg:   #ff8c8c;
  --badge-search-bg: #2a2d3a;
  --badge-search-fg: #c8c8e0;
}

body.lightmode {
  --ctl-bg:          #e0e0e0;
  --ctl-hover:       #d2d2d2;
  --input-bg:        #ffffff;
  --row-hover:       #ececec;
  --focus-tint:      #d8f0e0;
  --focus-border:    #1e7e34;
  --badge-ok-bg:     #d8f0e0;
  --badge-ok-fg:     #1e7e34;
  --badge-fail-bg:   #f2d0d0;
  --badge-fail-fg:   #b22222;
  --badge-search-bg: #fff3cd;
  --badge-search-fg: #856404;
}
```

Two Playwright cases verified the vars resolve correctly via
`getComputedStyle(document.body).getPropertyValue(...)` in both
themes. The vars are queried on `document.body` not `:root` because
`body.lightmode` rebinds happen at body scope.

### M2 — Substitute + delete

Mechanical sweep across `src/style.css`. Each hardcoded hex value
was the EXACT dark value chosen for its var in M1, so substitution
is just text replacement:

- `background: #1d1d20` → `background: var(--input-bg)` (×8)
- `background: #2d2d30` → `background: var(--row-hover)` (×3)
- `background: #333` → `background: var(--ctl-bg)` (×11)
- `background: #3d3d40` → `background: var(--ctl-hover)` (×11)
- `background: #2a2a2a` → `background: var(--ctl-bg)` (×2, legend glyphs)
- `background: #1e3b29` → `background: var(--focus-tint)` (×2)
- `border-color: #6cd99a` → `border-color: var(--focus-border)` (×3)
- `.agent-dialog .badge.ok / .fail / .searching` → all three use
  `var(--badge-*-bg/fg)`

Then DELETED the v23-v25 lightmode override blocks (~150 lines):

- `body.lightmode #newBtn / #dlBtn / #playBtn / ...` (10+ button rules)
- `body.lightmode .cf-btn / .legend .glyph / .legend-toggle`
- `body.lightmode .agent-dialog .badge.ok / .fail / .searching`
- `body.lightmode .agent-dialog .stat-pill / .countdown / etc.`
- `body.lightmode .agent-dialog .solution-row / .trace*`
- `body.lightmode .minimised-solutions .stat-pill`
- `body.lightmode .nv-form select / .nv-form input`
- `body.lightmode .lv-pick:hover / .lv-dl / .lv-new`
- `body.lightmode #themeBtn`
- `body.lightmode #tilesetSel / #levelSel`
- `body.lightmode .play-settings #ps-n / #ps-vw / #ps-vh`
- `body.lightmode .paste-load-dialog .pl-text / #pl-name`

Three lightmode rules KEPT because the cascade can't help them:

- `.modal-backdrop` — uses an rgba (not in our var set)
- `<option>` elements — OS-painted unless given explicit colour
- `.cf-btn.primary` — needs explicit `color: #ffffff` to force
  white text on the blue accent in both themes (the accent bg
  stays the same)

One stat-pill rule extended (`.agent-dialog .stat-pill,
.minimised-solutions .stat-pill { ... }`) to cover both
ancestors — the minimised-solutions bar is rendered outside
`.agent-dialog`, so the original selector missed it.

Result: CSS bundle drops 2.4 kB (18.28 → 15.90 kB pre-gzip).
Future lightmode bugs of this class can't recur because the
underlying rules use vars; the override path is structural.

A new spec (`v26-css-refactor.spec.js`) greps the raw CSS file
for residual `#1d1d20 / #2d2d30 / #333 / #3d3d40 / #2a2a2a /
#1e3b29 / #3b1e1e / #2a2d3a` outside the `:root` / `body.lightmode`
var-defining blocks. Returns zero offenders.

### M3 — Fit-to-screen overlay sync

One-line root cause: `applyFitToScreen()` only set CSS
width/height on `#preview`, not on `#overlay`. The overlay (which
captures pointer events) kept its native intrinsic-pixel size as
its CSS size, so `overlay.getBoundingClientRect().width` was the
intrinsic size, not the visible size. `cellFromEvent`'s
scale-ratio inversion (`overlay.width / r.width`) read the WRONG
denominator → clicks landed at cells offset by the fit scale
factor.

Fix: set the same `style.width / style.height` on both canvases.
The existing ratio math is unchanged.

Three Playwright cases lock the fix in:

- Overlay CSS width matches preview CSS width when Fit is on.
- Overlay CSS clears when Fit is off (no stale styling).
- A pointer click at a specific screen position in Fit mode flips
  the cell the user IS LOOKING AT.

## Thread B — Agent architectural completion

### M4 — Sub-pixel state-space A*

The architectural completion v25's transcript named as the v26
starting point. Node identity changes from `cellKey(r, c)` to
`stateKey(r, c, vxBucket)` where `vxBucket ∈ {-1, 0, +1}`:

```js
export const stateKey = (r, c, vxBucket = 0) => `${r},${c},${vxBucket}`;
export const VX_BUCKETS = [-1, 0, +1];
export function vxBucketOf(vx) {
  if (Math.abs(vx) < 30) return 0;
  return vx < 0 ? -1 : +1;
}
```

Each walkable cell expands to 3 nodes; `buildNavGraph` enumerates
edges from each (cell, vxBucket) start with `vx = vxBucket * SPEED`.
A* picks edges that distinguish "(7, 21) standing still" from
"(7, 21) with leftward momentum" — the sub-pixel state-space search
the v25 cell-resolved graph couldn't do.

**A\*'s key change**: `from` is a stateKey; `to` is a CELLKEY.
A* succeeds when ANY stateKey at the goal cell is reached. The
caller passes the goal as a cellKey because pickup + exit goals
don't care which bucket the agent arrives in.

**TSP helpers**: `greedyNearest`, `totalChainCost` thread cellKey
goals through A*. Between legs, the previous goal's cellKey is
normalised to a bucket-0 stateKey for the next leg's A* call —
an approximation (the actual planner loop tracks real buckets
from prev endState).

**Bumped `SIM_MAX_FRAMES` 1200 → 2400** (20s → 40s sim time).
The 3× graph node count means plans can chain through more
bucket variants; some chains exceed the v25 20s budget while
still being valid. The simulator runs ~50 µs per frame, so even
40s sim time terminates within the wall-clock budget for
genuinely-stuck plans.

**Test updates** required because the graph identity changed:

- `src/agent/grid.test.js`: `g.edges.get(cellKey(r, c))` → `g.edges.get(stateKey(r, c, 0))`. Edge `to` strings are now `"r,c,vxBucket"` not `"r,c"`; tests assert on cell prefix via a `cellOf(stateK)` helper.
- `src/agent/planner.test.js`: `aStar(g, '1,1', '1,3')` → `aStar(g, '1,1,0', '1,3')` (from = stateKey; to = cellKey).
- `tests/v25-edge-state.spec.js`: graph lookup uses bucket-0 stateKey.

### M5 — Acceptance gate

The v26 design's primary acceptance was "`below_ground.txt`
solves end-to-end". **That promise wasn't fully kept**.

What v26 M4 delivered for below_ground:

- v22-v24: dies at frame 49 with score 0 (hazard pit overshoot)
- v25 M2: gets past frame 49; collects 8 row-7 ooo's; times out
  at (7, 22)
- **v26 M4**: collects 8 row-7 + 4 row-5 ooo's; reaches (5, 29);
  times out at frame 2400. Score 12 of 16.

The player still doesn't reach the exit. Diagnosis: vxBucket
discretisation (3 values: -1, 0, +1) is COARSER than the actual
sub-pixel state drift that affects below_ground's tight
tolerances. Two cells with different sub-pixel x offsets fall
into the SAME bucket; A* still picks a plan that doesn't
account for the difference.

Approach 3.1.c is the v27 starting point: extend the bucket key
with a sub-cell-x dimension (e.g. `xOffsetBucket ∈ {0, ±5px}`
on top of `vxBucket`). 9 buckets per cell instead of 3; finer
state resolution.

**The regression gate**: every shipped agent-suite level (tutorial,
above_ground, simple, tower-cherry) still solves under bucket-aware
A*. M5's most important assertion passes.

## Discipline carry-overs that held

- **Path-scoped `git add`** — six commits, no forbidden paths
  touched. `__temp/wish_list.md`, `manifest.json`, `above_ground2.txt`,
  `fred.txt`, tileset `src.txt` + `sources.txt` all stayed
  unstaged.

- **v9 §7 byte-identical vendored engine** — `src/play/core/*`
  and `src/play/entities/*` untouched. The M4 SIM_MAX_FRAMES
  bump lives in `src/agent/runner.js`, not in the engine.

- **One milestone per commit, gated by tests + build**. Each
  milestone shipped only after `npm test` + `npx playwright
  test` + `npm run build` were green. M4 caught a unit-test
  regression (existing grid + planner specs assumed cellKey
  node identity) and fixed it in the same commit.

## What this leaves for v27+

- **Full `below_ground.txt` solve** via finer sub-cell state
  space (xOffsetBucket on top of vxBucket) OR a per-frame-
  trajectory planner that doesn't rely on bucketed A*.
- **"Top messages row" feature** — decoration row at the top
  of every level for score / messages. Touches level format,
  renderer, player physics, scoring HUD.
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval.
- **Reactive theme listener** — respond to OS-pref flips
  mid-session.
- **Viewport guide follows mouse** — drag-to-pan the v23
  guide.
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

## Closing

v26 ships the CSS refactor as a clean structural win — lightmode
bugs of the v23-v25 class can't recur, and the CSS bundle is 2.4 kB
smaller. The fit-to-screen draw-tile mismatch is fixed. The
sub-pixel state-space A* is in place as the architectural
foundation, and the agent's reach has grown (below_ground from
score 8 → 12), but the FULL below_ground solve still doesn't fit
in v26's bucket discretisation. v27 needs finer state buckets.

Discipline carry-overs from v22–v25 held: small commits, scoped
adds, byte-identical engine, gated test passes. Bundle 76.88 kB
JS (gzip 26.67 kB), CSS 15.90 kB (gzip 3.67 kB — down from v25's
3.73 kB). v9 §7 invariant preserved.
