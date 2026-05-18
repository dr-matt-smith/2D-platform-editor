# Version 2 — Implementation Plan & Record

Status: Delivered slice complete; backlog planned · Date: 2026-05-18 · Design:
[../1_design/version02_design.md](../1_design/version02_design.md)

Part A records what was built. Part B is the forward plan for the remaining
v1 §10 backlog carried into v2.

## Part A — Delivered (record)

### A1 — Tileset slicing (`9012f1c`, confirmed in `dff9b9a`)

- Inspected `platformertiles.png` by upscaling with a 32 px grid overlay and
  by per-tile alpha/colour stats → confirmed 32×32, 8×3, a 9-slice dirt block
  plus solid sky (11), moon (3), and ~95% transparent overlays (stars 13/14,
  stalactite 15, grass 21/22, drip 23).
- One-shot Python/PIL script crops 24 tiles to
  `public/.../Dirt_Platformer_Tiles/tiles/NN_name.png` and writes `tiles.json`
  (index, row/col, name, role, file). Not part of the app bundle; re-runnable
  if the atlas is swapped.
- `tileset.js` + design §3/§8 updated to mark the atlas confirmed; `#` mapped
  to the solid dirt centre (9).

### A2 — Example levels (`f63d7cf`, theme added in `2b49c48`)

- `levels/above_ground.txt` (sky) and `levels/below_ground.txt` (cave),
  generated programmatically to guarantee exact width and validated with the
  project's own `parse`+`validate` (0 errors). A walled-off exit in the cave
  was caught by inspection and corrected (no reachability lint exists).

### A3 — Autotiling + theme + decor (`2b49c48`)

- `renderer.js` → four-pass pure draw: background (theme-selected tile),
  9-slice autotiled dirt (`autotileIndex`, exported + unit-tested), themed
  decor (position-hashed for deterministic, flicker-free output), entities as
  shapes. No-atlas fallback path preserved.
- `level.js` → `theme` parsed into `meta.theme`; `THEMES` set validates the
  value; `serialize` emits it only when non-default (v1 byte-identical).
- Tests grew 14 → 20: theme parse/round-trip, 9-slice picks, atlas sky-fill,
  grass overlay, cave-theme decor suppression.

## Part B — Planned (forward steps)

### B1 — Rectangle fill + undo stack (design v2 §5 M6)

1. Add a custom history stack in `main.js` (snapshots of textarea value);
   wire `Ctrl/Cmd+Z` / `Shift+…+Z` to it, since non-text edits bypass native
   undo. Land this *with* fill, not after.
2. Selection model in the preview canvas: pointer drag → cell-rect, mirrored
   to a textarea text span. Renderer draws a selection overlay (new optional
   arg; keep `draw` otherwise pure).
3. Fill action rewrites the selected rectangle in the textarea value with the
   active glyph, pushes an undo snapshot, re-runs the pipeline.
4. Tests: a pure `fillRect(grid, x0,y0,x1,y1, glyph)` helper in `level.js`
   (text in/out) is unit-testable without DOM.

### B2 — Play-test runtime (design v2 §6, blocked)

Decision gate first: embed a tiny reference platformer (canvas + simple
gravity/AABB, reads the parsed grid) vs. export to an external runner.
Recommend embed for the sub-second loop the ideas doc prioritises. Implement
only after the user picks.

### B3 — Flood fill + line tool

Reuse B1's selection/undo. `floodFill` and `linePoints` as pure helpers in
`level.js`; thin UI hooks. Low cost once B1 exists.

### B4 — Reachability lint (promoted from v2 §6 gap)

Pure BFS/flood from `P` over non-solid cells in `validate.js`; unreachable
`E` → `error`, unreachable `o` → `warn`. Pure, unit-testable, and stops bad
example levels slipping through.

## Test & release discipline (both parts)

- Every change keeps `npm test` green and `npm run build` clean before commit.
- Pure helpers added to `level.js`/`validate.js` for new edit/lint logic so
  they are unit-tested without a DOM, consistent with v1.
- One feature per commit, message prefixed `v2 …`, design/docs updated in the
  same commit.
