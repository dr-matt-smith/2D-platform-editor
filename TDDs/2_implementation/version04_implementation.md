# Version 4 — Implementation Plan

Status: Delivered (M1–M5) · Date: 2026-05-18 · Design:
[../1_design/version04_design.md](../1_design/version04_design.md)

Record of the build. One milestone per commit, prefixed `v4 …`, **path-scoped
`git add`** (never `-A`) with a `git status` glance before each, `npm test`
green and `npm run build` clean throughout (suite 26 → 47).

| Milestone | Commit |
|-----------|--------|
| M1 off-grid-solid autotile rule + tests | `7162b57` |
| M2 pure fillRect/outlineRect helpers | `e7a48b2` |
| M3 capped undo/redo stack + key bindings | `9a1a8f6` |
| M4 rectangle draw tool (drag + glyph picker) | `597dede` |
| M5 docs + v04 transcript | this commit |

Notable deltas from the plan: M1's old 9-slice test asserted the *previous*
off-grid-open behaviour and was rewritten (not just extended); the M4
buffer↔grid splice was additionally verified out-of-app against a level with
a `//` comment interspersed in the grid (header + comment preserved). The
plan's per-milestone steps below were otherwise followed as written.

## Constraints & approach

- The autotile rule decision is settled: **single global off-grid-solid**, no
  theme-gate (design §5). It is already render-verified against both real
  levels via an out-of-app re-implementation.
- Keep `level.js`, `validate.js`, `renderer.js` pure. New edit logic lands as
  pure helpers in `level.js` so it is unit-tested headless, consistent with
  v1–v3.
- No new persistent chrome: the **active-glyph picker reuses the existing
  legend** (make entries clickable) rather than adding a toolbar — resolves
  the design §8 "tool affordance" question with the lighter option.
- Selection drawn on a **separate overlay canvas**, not by changing `draw()`'s
  signature — resolves design §8 "selection overlay purity".
- Undo = **whole-buffer snapshots, capped** (e.g. 100), redo cleared on new
  edit — resolves design §8 "undo granularity".

## Module map

| File | Status | Pure? |
|------|--------|-------|
| `src/renderer.js` | changed — `solid()` off-grid → `true` (1 line + comment) | yes |
| `src/level.js` | new pure `fillRect` / `outlineRect` helpers | yes |
| `src/history.js` | new — capped snapshot undo/redo stack | yes (deps injected) |
| `src/main.js` | changed — drag-select, glyph picker, undo keys, buffer splice | no |
| `src/style.css` | changed — overlay canvas, active-glyph highlight | n/a |

## Milestone 1 — off-grid-solid autotile rule

1. `renderer.js`: `solid(grid,r,c)` returns `true` when `r`/`c` is off-grid
   (currently `false`); update the `autotileIndex` comment ("off-grid counts
   as solid: the world is implicit dirt the level is carved from").
2. Extend `renderer.test.js`: a 1-wide left wall column with open space to its
   right → `dirt_right` (10); right wall → `dirt_left` (8); bottom floor row →
   `dirt_top` (1); ceiling → `dirt_bottom` (17); a free-standing block away
   from edges is unchanged (regression guard).
3. Re-verify both example levels with the render harness; refresh the
   `v4_preview/` composites for the record (git-ignored).

Commit: `v4 m1: off-grid-solid autotile rule + tests`.

## Milestone 2 — pure rectangle helpers

1. `level.js`: `fillRect(grid, x0, y0, x1, y1, glyph)` and
   `outlineRect(grid, x0, y0, x1, y1, glyph)` operating on the **grid rows
   array** (not raw text). Normalise corners (min/max), clamp to grid bounds,
   preserve every row's width, return a new array (no mutation).
2. Tests (`src/rect.test.js`): corner-order independence, clamping past
   bounds, width/height preserved, `outlineRect` touches border cells only,
   filling with `.` erases, single-cell and degenerate rects.

Commit: `v4 m2: pure fillRect/outlineRect helpers (tested)`.

## Milestone 3 — undo/redo stack

1. `history.js`: `createHistory({ limit = 100 })` → `push(snapshot)`,
   `undo(current)`, `redo()`, `canUndo/canRedo`. Whole-buffer strings; pushing
   clears the redo branch; oldest dropped past `limit`.
2. Unit tests: push/undo/redo ordering, redo cleared on new push, cap
   eviction.
3. `main.js`: snapshot before each committed mutation (debounced typing that
   actually changed the buffer, and every fill/outline); bind
   `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z`. Native textarea undo coexists for
   keystroke-level; the stack guarantees fills are reversible in one step.

Commit: `v4 m3: capped undo/redo stack + key bindings`.

## Milestone 4 — drag-select + glyph picker → fill

1. Overlay `<canvas>` layered over the preview; pointer down/move/up computes
   a cell-rect (using the existing tile size + char metrics); draw the
   marquee on the overlay only.
2. Legend entries become buttons → set the active glyph (default `#`,
   includes `.`); highlight the active one.
3. On release: apply `fillRect` (or `outlineRect` with a modifier/toggle) to
   the parsed grid, **splice the changed rows back into the raw buffer** using
   `parsed.rows[].line` offsets so the header/comments are preserved, push an
   undo snapshot, re-run the pipeline.
4. Dev smoke (build + serve); the drag/fill interaction itself is
   browser-verified manually — no automated DOM test, as in v2/v3.

Commit: `v4 m4: rectangle draw tool (drag-select + glyph picker)`.

## Milestone 5 — docs + transcript

Update design refs; add platform-depth guidance (§4) to
`public/data/levels/README.md`; add `TDDs/3_transcripts/version04_build.md`;
mark this plan Delivered with commit hashes.

Commit: `v4 m5: docs + v04 transcript`.

## Risks & sequencing

- **M1** is independent and the safest change (already render-verified); do it
  first so the rule is locked before the tool builds on it.
- **Buffer↔grid splice (M4) is the real risk.** Helpers act on the grid rows
  array; the textarea holds header + comments + grid. Mapping edits back must
  use the parser's original line numbers (`parsed.rows`), and ragged/short
  rows must be padded to the rect's reach. Build M2 pure + tested first so
  only the splice glue is unproven in M4.
- **Undo coexistence:** native textarea undo and the custom stack can diverge;
  the stack is authoritative for fills. Document the expectation; don't try to
  unify them.
- M2 and M3 are independent of each other and of M1 — parallelisable, but
  committed in order for a clean history.

## Deferred / non-goals (design §11)

Flood fill + line tool, per-tile variant randomisation, reachability lint,
play-test runtime — all v5. v4 adds rectangle fill/outline only.
