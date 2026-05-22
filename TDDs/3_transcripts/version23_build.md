# Transcript — Version 23: Editor Polish, Themed Editor, and the Action-Graph Probe

A narrative record of the v23 phase. Two parallel threads — editor /
play polish (M1–M5) and agent action-graph completeness (M6) — landed
in one version, with the polish shipping first and the action-graph
work landing as the acceptance-gated finale. M7 closed the loop with
a transcript, acceptance specs, and the Delivered marker.

The brief, from the wishlist the user added after v22 shipped:

1. Toolbar height pin (canvas no longer shifts entering Play)
2. Light/dark mode toggle (subtle 🌗 button in the toolbar)
3. Viewport bounding rectangle in Design mode (dashed yellow rect)
4. Fit-to-screen squashing fix (Play and Test should use the same
   sizing as Design when Fit is selected)
5. Minimised mode for solutions panel (keep the path overlay visible)
6. Agent action-graph completeness — close the `tutorial.txt`
   acceptance gap that v22 left documented as a v23 candidate

The user's go-ahead, verbatim:

> implement milestones please

## The shape of the work

Seven small commits, one milestone each:

| M | Commit    | Deliverable                                                                                                  |
|---|-----------|--------------------------------------------------------------------------------------------------------------|
| 1 | `fa9a723` | `.status { min-height: 40px }` so the toolbar doesn't shrink in Play mode + Play-Settings popup title + accent HR between Viewport and Pickup sections |
| 2 | `8887b09` | `body.lightmode` re-binds the five CSS custom properties at body scope; 🌗 toolbar toggle; localStorage persistence + first-load default 'dark' |
| 3 | `e1902f0` | `drawViewportGuide(octx, parsed, tile)` paints a dashed yellow rectangle on `#overlay` when `meta.viewport` is set; centred on the player spawn (or geometric centre) — editor-only |
| 4 | `efe0a60` | `applyPlayFitToScreen()` paired with `applyFitToScreen()`; threads the v18 CSS pin formula × `min(availW/cssW, availH/cssH)` when Fit is on; testBtn rAF-defer so the post-`body.testmode` recalc drives the re-fit |
| 5 | `c4326e4` | `[—]` button in the agent dialog header swaps the modal for a `.minimised-solutions` floating bar pinned to the top of canvas-wrap. Backdrop turns transparent + click-through; path overlay stays visible. Persisted via `v23.dialogMinimised`. |
| 6 | `beb041c` | `src/agent/actions.js` adds `drop_release{dir, releaseFrame}` and `run_off{dir, walkCells}` to enumerateActions. Per-cell candidate count: 28 → 46. simAction recognises both as air actions. |
| 7 | _this commit_ | v23 transcript; acceptance e2e; design + impl Delivered with M1–M7 hash table |

Outcome: 288 → 295 unit tests (+7 actions cases for v23). Playwright
28 → 50 (M1 ×2, M2 ×3, M3 ×3, M4 ×3, M5 ×4, M6 ×4 + cross-cutting).
v9 §7 byte-identical invariant for `src/play/core/*` +
`src/play/entities/*` preserved across all seven commits. Bundle:
67.42 kB → 71.16 kB JS (gzip 23.67 → 24.74 kB). Path-scoped
`git add` discipline held — no `__temp/`, no `manifest.json`,
no `above_ground2.txt` / `fred.txt`, no tileset `src.txt` /
`sources.txt` touched the index.

## Thread A — Editor / play polish

### M1 — Toolbar height pin + Play Settings popup polish

Two small editor-polish items combined. The user-reported "tile-shift"
when entering Play was caused by the toolbar's natural-content-height
shrinking — 10 controls (selects + multi-button row) in edit mode vs
2 (Restart + Exit) in play mode. The `.canvas-wrap` below took the
freed pixels and the canvas's `getBoundingClientRect().top` moved
upward by ~2 px.

Fix: `.status { min-height: 40px; }`. The natural edit-mode height
(after M2's 🌗 button was added) is now also the floor in play mode.
Sub-pixel-perfect for the shipped fonts; v24 candidate to read at
runtime if user fonts diverge.

The Play Settings popup gained `<header class="play-settings-header">`
and `<hr class="popup-divider">` — the latter uses the new
`--accent` custom property promoted to `:root` so M2's light theme
can re-bind it. Two `<p>` headings ("Viewport — …", "Pickup
requirement — …") with no visual separator were doing the wrong
job; an explicit HR with a 2px accent-green border-top reads better.

### M2 — Light / dark mode toggle

`body.lightmode` re-binds `--bg`, `--fg`, `--line`, `--dim`, `--guide`,
`--panel`, and `--accent` at body scope. Everything already reading
those variables flips automatically. Hardcoded button backgrounds
(`#333` across `#newBtn` / `#dlBtn` / `#playBtn` / `#playSettingsBtn`
/ `#testBtn` / `#fitBtn` / `#restartBtn` / `#exitBtn` / `.cf-btn` /
`.legend .glyph` / `.legend .legend-toggle`) get a `body.lightmode`
override block; agent-dialog success/fail badges re-tinted for
contrast; modal-backdrop alpha reduced; textarea + selects +
number-inputs flipped to white-on-dark-text.

The toolbar gained a single 🌗 button between `#fitBtn` and `#newBtn`.
Title attribute tells the user which mode they're toggling INTO.
State persisted via `v23.theme` (enum 'dark' | 'light'); first-load
default stays 'dark' (no breaking change for existing users).

Discovered mid-M2: the new button raised the natural edit-mode
toolbar height from 38 px to 40 px, breaking M1's pin assertion.
Bumped `min-height` from 38 to 40. Documented in the M2 commit
message because the M1 acceptance test re-passed against the new
value.

### M3 — Viewport bounding rectangle

When a level sets `# viewport: WxH`, Design mode paints a dashed
yellow rect on `#overlay` showing where the play-time visible band
will sit. `drawViewportGuide(octx, parsed, tile)` reads
`parsed.meta.viewport`, centres on the player spawn cell (`P`),
falls back to the geometric centre, clamps to world bounds, and
strokes via `octx.setLineDash([6, 4])`.

Editor-only: called from `run()` which early-returns in play mode,
so the guide vanishes naturally when entering Play / Demo / Test
without a separate clear pass. Repaints from the existing reflow
chain so every buffer edit AND every level switch refreshes the
guide automatically.

Three Playwright cases: edge has yellow alpha (sample the dashed
stroke), interior has alpha 0 (just an outline, not a fill), guide
hidden in Play mode (overlay blank at the same coordinates).

### M4 — Fit-to-screen ↔ Play / Test

The v22 fit toggle scaled the Design canvas but stopped at the
play/test boundary — entering Play with Fit on snapped the canvas
back to its intrinsic `pinCells * TILE` width (the v18 CSS pin
formula). The user's word for this: "squashed".

v23 keeps the same v18 pin as the base case AND multiplies cssW /
cssH by `min(availW/cssW, availH/cssH)` when `fitToScreen` is on.
The off-mode path is byte-identical to v18/v19 — when the user
hasn't toggled Fit, nothing about Play mode rendering changes.

```js
function applyPlayFitToScreen() {
  if (!currentPlayPin) return;
  if (editorMode !== 'play' && editorMode !== 'demo') return;
  const { cssW, cssH } = currentPlayPin;
  if (!fitToScreen) {
    previewCanvas.style.width = `${cssW}px`;
    previewCanvas.style.height = `${cssH}px`;
    return;
  }
  const wrap = document.querySelector('.canvas-wrap');
  const availW = wrap.clientWidth - 24;
  const availH = wrap.clientHeight - 24;
  const scale = Math.min(availW / cssW, availH / cssH);
  previewCanvas.style.width = `${Math.floor(cssW * scale)}px`;
  previewCanvas.style.height = `${Math.floor(cssH * scale)}px`;
}
```

`tryPlaytest()` stashes `{ cssW, cssH }` on a module-level
`currentPlayPin` on launch so the resize listener can re-scale
without needing to recompute pinCells. `exitPlaytest()` clears it.

The Test handler's `applyFitToScreen()` call is now `rAF`-deferred
— the v22 M5 synchronous call ran BEFORE `body.testmode`'s CSS
collapsed the legend track to zero, so the canvas couldn't grow
into the freed space. One `requestAnimationFrame` lets layout
recalc first.

### M5 — Minimisable solutions panel

The agent dialog's success state gains a `[—]` button in the
header that swaps the full modal for a thin floating bar pinned
to the top of the canvas-wrap:

```
[ ✓ 3 solutions │ S1 │ 16 steps · 1 jump · 1 pickup │ ▶ Demo │ ↕ Expand │ × ]
```

The bar shows the focused-solution's stats; Demo / Expand / Close
remain reachable. The `.modal-backdrop` itself stays in the DOM
but with `background: transparent` + `pointer-events: none` so the
path overlay behind is visible AND the user can interact with the
canvas (e.g. pan a scrolling viewport). The bar re-enables
`pointer-events: auto` on itself.

Persisted via `v23.dialogMinimised` so power users who prefer the
overlay-visible view get it automatically on every subsequent Test
run. Four Playwright cases: minimise hides full dialog, expand
restores, persistence across reload, Demo button in bar replays
the recording.

## Thread B — Agent action-graph completeness

### M6 — `drop_release` and `run_off`

Two new edge types extend the v21 enumeration:

**`drop_release{dir, releaseFrame}`** — drop with EXPLICIT mid-fall
direction release. Pre-release: held vx; post-release: vx → 0,
pure vertical fall. The analog of release-mid-jump for drops, with
four release-frames {8, 16, 24, 32} giving variable mid-fall pivot
points. Unlocks landings that the original `drop` (hold dir for
60 frames) overshoots.

**`run_off{dir, walkCells}`** — walk N cells (building vx to walk-
speed) THEN carry into the fall via held dir. Encodes "walk along
this platform and step off the end" as an explicit edge with
walk-distance variants {2, 3, 4, 5, 6}. Falls back to a long-walk
when there's no ledge in range.

Per-cell candidate count: 28 → 46. Graph build time grows ~60% but
stays well under the 5 s primary budget. `simAction.isAirAction`
recognises both new kinds so the sim loop early-exits on landing.

### The `tutorial.txt` probe

A graph-build diagnostic + a frame-by-frame trajectory probe (both
shipped as temporary `_v23-*-probe.spec.js` then deleted) revealed
that the v22-flagged `tutorial.txt` failure is a **level-geometry
issue**, not an action-graph gap:

- Spawn settles to (8, 4) on the bottom floor.
- Peak jump height = JUMP_FORCE² / (2 · GRAVITY) = 560² / 3200 =
  98 px = **4.9 cells**. From row 8, peak reaches row 3.1 — not
  enough to reach the row-2 exit platform.
- Intermediate ooo platform at row 4 IS reachable; the agent's
  graph confirms (4, 7) through (4, 12) are all reachable.
- A jump from any (4, x) toward the exit hits the row-0 ceiling
  (peak would be row -0.9, but ceiling at row 0 bumps it back),
  and during the descent the player passes the platform-top
  boundary (y = 60) at cols 16–17 — TOO FAR LEFT of the exit
  platform (cols 18–22). Player falls back to row 8.
- No reachable cell + no enumerable action produces an edge to
  (2, 18–22). The shipped level is physically unreachable in the
  current engine.

The trajectory probe's evidence at frame-by-frame resolution:

```
f=22 x=328.0 y=60.4 vy=346.7 cell=(3,16)   ← crossed platform-top y=60
f=23 x=332.0 y=66.7 vy=373.3 cell=(3,17)   ← still LEFT of exit platform
f=28 x=352.0 y=104.4 vy=506.7 cell=(5,18)  ← now over exit cols, but
f=33 x=372.0 y=153.3 vy=640.0 cell=(8,19)  ← well below row 2
f=34 LANDED at (8, 19) — bottom floor
```

So tutorial.txt rides in v23 as documented carry-over to v24. The
fix is either:
- **Level-design**: add an intermediate platform at row 2 or row 3,
  closer to col 12–17, bridging the gap from the ooo platform.
- **Engine extension**: introduce a double-jump (one additional
  in-air vy = -JUMP_FORCE press) or a wall-climb mechanic. This
  WOULD break the v9 §7 byte-identical-to-upstream invariant — a
  significant architectural shift.

Documented as v24 candidate. The M6 action-graph extensions stand
independently — they expand the agent's reach on future levels
with narrow gaps or precision landings.

`below_ground.txt` was re-investigated in the same session — still
dies at frame 49 from a hazard touch during the spawn-fall. v24
candidate alongside tutorial.txt.

## Discipline carry-overs that bit (and didn't)

- **Path-scoped `git add`** — the [[scoped-git-add]] memory rule
  held all seven v23 commits. `__temp/`, `manifest.json`,
  `above_ground2.txt`, `fred.txt`, the `IncaTiles/src.txt` and
  `PlayWithYourPeas/sources.txt` files all stayed unstaged across
  every commit. The user's locally-modified `34_block_spikes.png`
  (probably an IDE re-save) also stayed unstaged.

- **v9 §7 byte-identical vendored engine** — `src/play/core/*` and
  `src/play/entities/*` untouched. M4's CSS-pin refactor happened
  in `main.js`; M6's action types live in `src/agent/`. No engine
  primitives were modified.

- **One milestone per commit** — seven commits, seven logical
  units. Each shipped only after `npm test` + `npx playwright test`
  + `npm run build` were green. M2 caught the M1-toolbar-pin
  regression (the new 🌗 button raised the natural toolbar height
  from 38 to 40 px) and fixed it in the same commit, not papered
  over.

## What this leaves for v24+

- **`tutorial.txt` solvability** — either level-redesign (add
  intermediate platforms) or engine-extension (double-jump). v23
  closed the action-graph gap diagnostic; the next step is the
  geometry / capability fix.
- **`below_ground.txt`** — spawn-fall hazard touch at frame 49.
  Suspected interaction between v22's spawn-settle and a hazard
  cell directly below the spawn glyph.
- **Runtime-measured toolbar height** — read first paint into a
  `--toolbar-h` custom property for sub-pixel-perfect Play-mode pin.
- **`prefers-color-scheme` first-load theme default**.
- **Viewport guide follows mouse** — drag-to-pan the guide
  rectangle.
- **Multi-coloured path overlay** for the multi-solution display
  (long-standing).
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence** — all v22 +
  v23 carry-overs.
- Plus the long-standing v16/v17/v18/v19 carry-overs.

## Closing

v23 ships the editor-polish thread (toolbar pin, themed editor,
viewport guide, fit-in-play, minimised solutions panel) and the
agent action-graph extensions (`drop_release`, `run_off`) the v22
acceptance criterion called for. The `tutorial.txt` carry-over got
a more SPECIFIC diagnostic — it's a level-geometry issue, not an
action-graph gap, so v24's target is now well-defined (intermediate
platform OR engine capability extension).

The two threads didn't share code; they shared discipline. Small
commits, scoped adds, byte-identical engine, gated test passes.
Bundle 71.16 kB JS (gzip 24.74 kB). v9 §7 invariant preserved.
