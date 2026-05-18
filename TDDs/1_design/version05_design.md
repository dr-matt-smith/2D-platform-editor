# 2D Level Designer — Version 5 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version04_design.md](version04_design.md)

## 1. Purpose

Single-tile-thick walls currently render with the 9-slice dirt block, which
was designed for thick masses and looks lopsided on a 1-cell strip (a 1-wide
pillar comes out as `dirt_left`; a 1-deep ledge as `dirt_top` with no
underside). The atlas already has a **vertical** 1-wide platform set —
`platform_top` (4), `platform_mid` (12), `platform_bottom` (20): a capped
pillar with a rocky rim on top/sides, sides-only, bottom/sides. v5:

- **(a)** add the matching **horizontal** 1-tile platform tiles by rotating
  the vertical set 90°.
- **(b)** change tile selection so a wall that is 1 cell thick (open space on
  both opposing sides) uses these platform tiles instead of the 9-slice, and
  a lone wall cell open on all four sides uses a dedicated `platform_single`
  tile composed in the same style.

This **supersedes** the v4 §4 "1-deep platform = `dirt_top` + end caps"
treatment with a purpose-built look.

## 2. Scope

### In scope

- Horizontal platform tiles (`platform_left`, `platform_mid_h`,
  `platform_right`) derived from the vertical set by 90° rotation.
- A "thin run" pass in tile selection: vertical 1-wide and horizontal 1-tall
  runs map to the platform sets; everything else keeps the v4 9-slice rule.
- A **dedicated 1×1 isolated tile** (`platform_single`) in the same style,
  composed from the two horizontal end caps, used when a single wall cell is
  surrounded by empty on all four sides.
- Tests for the selection logic; re-verify the example levels render well.

### Out of scope

- New authored levels; flood/line tools; reachability; runtime (still v6+).

## 3. (a) Horizontal platform tiles

The vertical set rotated 90° yields the horizontal caps (rim faces named by
the rocky edge):

| Horizontal tile (index) | Source (vertical) | Rotation | Rim faces |
|-------------------------|-------------------|----------|-----------|
| `platform_left` (24) | `platform_bottom` (20) | 90° CW | left + top + bottom |
| `platform_mid_h` (25) | `platform_mid` (12) | 90° | top + bottom |
| `platform_right` (26) | `platform_top` (4) | 90° CW | right + top + bottom |

**Recommended: pre-baked tiles, generated once by the slicing pipeline.**
The pipeline already emits per-tile PNGs; it additionally rotates tiles
20/12/4 with PIL (`Image.rotate(-90, expand=True)`) into
`tiles/24_platform_left.png` … `26_platform_right.png` and adds the three
`tiles.json` entries.

Rationale (this reverses the first draft, which proposed draw-time rotation):
keeping rotation out of the render path is the bigger simplification. Tile
selection stays "return an index, blit it" — `pickTile`/`autotileIndex`
return a plain number, the renderer's hot path and its tests are untouched,
and there is no `{index, quarter}` descriptor rippling through the code. The
rotation cost collapses to one deterministic, inspectable offline step.

### `platform_single` (27) — the 1×1 isolated tile

A fourth generated tile, in the same dirt style, for a lone wall cell open on
all four sides. Composed (not rotated): the **left 16 px of `platform_left`
(24)** + the **right 16 px of `platform_right` (26)**, giving left- and
right-end caps in one 32-px tile (both already carry the top+bottom rim, so
the result is rimmed on all four sides). The pipeline writes
`tiles/27_platform_single.png` and its `tiles.json` entry.

The vertical seam at x = 16 may show a 1–2 px discontinuity in the rocky
texture; the generation step blends/patches that column. Seam quality is a
generation concern, **visually verified** when the pipeline emits it
(milestone 2 / §7), not a runtime concern.

The atlas is exactly 8×3 = 24 tiles with **no spare slot**, so the four new
tiles are *not* packed into the source atlas (which would force a resize and
re-slice). They are loaded as standalone images and addressed by synthetic
indices 24–27 (§5).

## 4. (b) Thin-run tile selection

Definitions for a solid cell (`solid()` already counts off-grid as solid,
v4 §3). "Open" = the neighbour is not solid.

Selection order (first match wins):

- **isolated 1×1**: all four neighbours open → `platform_single` (27).
- **vertical thin**: `left` open **and** `right` open → part of a 1-wide
  column. Pick by up/down:
  - up open → `platform_top` (4)
  - up solid & down solid → `platform_mid` (12)
  - down open → `platform_bottom` (20)
- **horizontal thin**: `up` open **and** `down` open → part of a 1-tall
  row. Pick by left/right (pre-baked tiles 24–26):
  - left open → `platform_left` (24)
  - left solid & right solid → `platform_mid_h` (25)
  - right open → `platform_right` (26)
- **otherwise**: the existing v4 9-slice rule, unchanged.

### Precedence

The isolated 1×1 check runs **first** because a lone cell satisfies both thin
conditions; resolving it to `platform_single` removes the earlier ambiguity
(the v4 9-slice fallback is no longer used for this case). Vertical is tried
before horizontal for genuine runs; they are mutually exclusive for any run
longer than one cell, so the order only matters for the 1×1 cell, which the
first rule already claims.

### Interaction with boundaries (off-grid solid)

Because off-grid is solid (v4 §3), a 1-wide column flush against the map edge
is *not* "thin" (one side is the solid world), so it stays a boundary wall.
Thin selection therefore only triggers for genuinely free-floating 1-cell
runs in open space — exactly the intent.

### Interaction with the decor pass

The decor pass adds grass on `#` with open sky above and drips on open below.
A horizontal 1-tall platform has both, so `platform_mid_h` (already rimmed
top+bottom) could double up with grass+drip. Decision: **suppress the decor
pass on cells selected as thin-platform tiles** (the platform art already
reads as a finished ledge). Open question if grass-on-top is still wanted
(§7).

## 5. Architecture / impact

Tile selection stays a **plain integer index** end to end — the key
simplification from choosing pre-baked tiles over draw-time rotation.

- **`pickTile(grid,r,c) → number`** — new pure selector: isolated 1×1 → 27,
  thin-vertical → 4/12/20, thin-horizontal → 24/25/26, otherwise the v4
  9-slice index. `autotileIndex` is retained and delegates (its existing
  tests and the thick-wall behaviour are unchanged).
- **slicing pipeline** — additionally generates four tiles: rotate atlas
  tiles 20/12/4 (`PIL Image.rotate(-90, expand=True)`) →
  `tiles/24_platform_left.png` … `26_platform_right.png`; and **compose**
  `27_platform_single.png` from the left half of 24 + the right half of 26
  with a seam patch (§3). Appends the four `tiles.json` entries. One-shot,
  deterministic, inspectable.
- **`tileset.js`** — loads the four standalone PNGs alongside the atlas;
  `drawTile(ctx,index,…)` sources indices ≥ 24 from those images, < 24 from
  the atlas as today. No rotation code, no `quarter` argument.
- **`renderer.js`** — call `pickTile` instead of `autotileIndex`; skip the
  decor pass for cells selected as thin-platform/single tiles. Stays pure.
- **`level.js` / `validate.js`** — untouched.
- **Tests** — `pickTile` is pure and returns numbers: unit-test
  vertical/horizontal runs, caps vs. middle, the boundary non-trigger, and
  the isolated-1×1 → 27 case. Image loading/sourcing and seam quality are
  dev-smoke + render-harness verified (no automated canvas test, as since
  v2).

## 6. Milestones

| # | Deliverable |
|---|-------------|
| 1 | `pickTile` (plain index) + thin-run rules + unit tests; `autotileIndex` delegates (no behaviour change for thick walls) |
| 2 | Slicing pipeline emits the 3 rotated PNGs + composed `27_platform_single.png` + `tiles.json` entries; `tileset.js` loads/sources indices 24–27 |
| 3 | `renderer.js` uses `pickTile`, suppresses decor on thin/single cells; re-verify both example levels via the render harness |
| 4 | Docs + v05 transcript; update v4 §4 reference (superseded); platform note in `data/levels/README.md` |

## 7. Open questions

- **Grass on thin platforms** — fully suppress decor (recommended, cleaner),
  or still allow grass tufts on the top of a horizontal platform for the
  sky theme? Needs a visual check.
- **`platform_single` seam** — does the left-half/right-half composite join
  cleanly, or is a wider blend / a different composite (e.g. four corner
  quadrants) needed? Visually verified when the pipeline emits it (M2). The
  selection logic is unaffected either way.
- **Rotation direction when generating** — `platform_left` must cap the left
  end and `platform_right` the right; confirm the PIL rotation sign against
  the actual pixels when the pipeline emits them (milestone 2). `mid_h`'s rim
  is symmetric so either direction is fine for it.
- **2-thick runs** — explicitly unchanged (only exactly-1-thick is "thin");
  confirm this reads correctly where a thin platform meets a thick mass.

## 8. Acceptance criteria

- A free-floating 1-wide vertical pillar renders `platform_top` / repeated
  `platform_mid` / `platform_bottom`.
- A free-floating 1-tall horizontal ledge renders `platform_left` /
  `platform_mid_h` / `platform_right` (rotated set).
- A lone wall cell open on all four sides renders `platform_single` (27),
  not a 9-slice corner.
- Thick walls and boundary walls are byte-for-byte unchanged from v4
  (`autotileIndex` delegation proven by the existing tests still passing).
- The 4 platform PNGs (3 rotated + 1 composed) are generated by the pipeline
  with matching `tiles.json` entries; the renderer sources them with no
  rotation code and `pickTile` returns plain integer indices throughout.
- `pickTile` is pure and unit-tested; `npm test` green, `npm run build`
  clean; example levels re-verified.

## 9. v6 candidates

Per-tile variant randomisation; flood fill + line tool; reachability lint;
play-test runtime (long-standing, v2 §6).
