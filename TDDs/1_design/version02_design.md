# 2D Level Designer — Version 2 Design Document

Status: Draft · Date: 2026-05-18 · Builds on: [version01_design.md](version01_design.md)
· Backlog source: version01 §10

## 1. Purpose

v1 delivered a pleasant text-first editor with a flat preview (one tile per
`#`, entities as shapes). v2 makes the preview *look like a real level*: the
dirt block autotiles, levels carry a visual theme, and the tileset is broken
into addressable assets. It also sets scope for the remaining v1 §10 backlog.

## 2. Scope

### Delivered in v2 (built ahead of the rest of the backlog)

1. **Tileset slicing pipeline** — `platformertiles.png` confirmed as a 32×32
   8×3 atlas (24 tiles: a 9-slice dirt block + sky/moon/decor overlays). Sliced
   to `public/.../Dirt_Platformer_Tiles/tiles/NN_name.png` with a `tiles.json`
   manifest (index, row/col, name, role, file).
2. **9-slice autotiling** — each `#` selects a corner/edge/centre tile from
   the dirt block based on its 4-neighbours; off-grid counts as open so map
   borders read as rocky edges.
3. **Themed decor layer** — a deterministic, position-hashed pass adds moon,
   sparse stars and surface grass (`sky`) or stalactite drips (`sky` + `cave`).
4. **`# theme:` directive** — additive header field, `sky` (default) | `cave`;
   unknown → `sky`. Selects background + decor only; no gameplay/validation
   impact. Round-trips through serialize.
5. **Two example levels** — `levels/above_ground.txt` (sky) and
   `levels/below_ground.txt` (cave) *(moved to `public/data/levels/…` in v3)*,
   authored from the tileset screenshots and passing the v1 validator with
   zero errors.

### Planned for v2 (remaining backlog, ranked)

1. **Rectangle fill** — the deferred v1 feature; v1 is character-by-character
   typing only. Brings in a custom undo stack (non-text edits bypass native
   textarea undo).
2. **Real play-test runtime** — closes the biggest v1 §8 gap. Decision still
   open: embed a tiny reference platformer vs. export to an external runner.
3. **Flood fill + line tool** — share rectangle fill's selection/undo
   machinery; cheap once (1) lands.
4. **Jump-to-coordinate + minimap** — navigation for levels larger than the
   viewport.
5. **Templates / procedural seeds** — blank-page problem.

### Out of scope for v2

Layers / multi-character cells and entity properties (format + parser
rewrite — own design pass). Per-tile variant randomisation, parallax, and
additional themes are noted as v3 candidates (§8).

## 3. Format changes

One additive header directive; the v1 format is otherwise unchanged and v1
files parse identically (theme defaults to `sky`).

```
# name: below_ground
# theme: cave        <- new in v2; sky | cave; default sky
# size: 40x16
########################################
...
```

- `theme` is read in the header region only, like `name`/`size`. Validation
  is unaffected — an unknown theme is silently coerced to `sky` rather than
  flagged, because it never makes a level unplayable.
- `serialize` emits `# theme:` only when non-default, so canonical v1 output
  is byte-identical to before.

## 4. Architecture changes

Only two v1 modules changed; `level.js` and `validate.js` rules are otherwise
untouched.

- **`level.js`** — parse reads `theme` into `meta.theme`; `THEMES` set is the
  single source of valid values; serialize emits it when non-default.
- **`renderer.js`** — still pure (parsed + tileset in, pixels out). Now a
  four-pass draw: (1) background tile per cell (sky vs. `dirt_fill` by theme),
  (2) autotiled dirt, (3) themed decor (position-hashed for determinism),
  (4) entities/hazard as shapes. The no-atlas fallback path is unchanged.
- **`tileset.js`** — atlas metadata confirmed; `GLYPH_TILE` maps `#` to the
  solid centre. Per-tile names live in `tiles.json` (asset-side, not bundled).
- **New: slicing pipeline** — a one-shot script (not part of the app bundle)
  that crops the atlas and writes `tiles/` + `tiles.json`. Re-runnable if the
  atlas is replaced.

### Autotile rule

For a solid cell, `solid(n)` = in-bounds and `== '#'`; off-grid is open.
`row = up ? (down ? 1 : 2) : 0`, `col = left ? (right ? 1 : 2) : 0`,
tile = `dirt[row*3+col]` over the 9-slice indices `0,1,2 / 8,9,10 / 16,17,18`.
Pure and unit-tested independently of canvas.

## 5. Milestones

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Atlas inspected + sliced + `tiles.json` | done |
| 2 | Two example levels authored + validated | done |
| 3 | 9-slice autotiling in renderer + tests | done |
| 4 | `# theme:` parse/serialize + tests | done |
| 5 | Themed decor pass + tests | done |
| 6 | Rectangle fill + undo stack | planned |
| 7 | Play-test runtime (after embed/export decision) | planned |

## 6. Open questions / known gaps

- **Play-test loop:** still unresolved from v1 §8 — embed a reference
  platformer or export to an external runner? Blocks milestone 7.
- **Reachability:** validator still has no flood-fill reachability check, so an
  unsolvable level passes. `below_ground.txt` was hand-checked for a walled-off
  exit; this should become a lint before more levels are authored.
- **In-browser visual parity:** the autotiling/decor output was confirmed via a
  faithful out-of-app re-implementation, not an automated browser snapshot. A
  real screenshot test is desirable but unscoped.
- **Undo for non-text edits:** rectangle fill (milestone 6) bypasses native
  textarea undo; the custom history stack from v1 §8 must land with it.

## 7. Acceptance criteria for v2 (delivered slice)

- `tiles.json` lists 24 tiles; every entry's `file` exists under `tiles/`.
- A 3×3 `#` block emits exactly the nine 9-slice indices; a lone `#` emits the
  top-left corner. (unit-tested)
- `# theme: cave` ⇒ dark background, no moon/stars/grass, drips retained;
  `sky`/default ⇒ night background with celestial decor. (unit-tested)
- Both example levels validate with zero errors and render close to their
  source screenshots.
- A v1 level with no `# theme:` parses and serialises byte-identically to v1.

## 8. v3 candidates

Not commitments. Per-tile variant randomisation (use the unused dirt/dark
variants), parallax/animated decor, more themes (e.g. `lava`, `ice`),
reachability lint, and an in-browser visual regression harness.
