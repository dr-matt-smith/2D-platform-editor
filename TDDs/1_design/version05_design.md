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
  both opposing sides) uses these platform tiles instead of the 9-slice.

This **supersedes** the v4 §4 "1-deep platform = `dirt_top` + end caps"
treatment with a purpose-built look.

## 2. Scope

### In scope

- Horizontal platform tiles (`platform_left`, `platform_mid_h`,
  `platform_right`) derived from the vertical set by 90° rotation.
- A "thin run" pass in tile selection: vertical 1-wide and horizontal 1-tall
  runs map to the platform sets; everything else keeps the v4 9-slice rule.
- Tests for the selection logic; re-verify the example levels render well.

### Out of scope

- A dedicated 1×1 isolated-cell tile (the atlas has no double-cap tile) —
  handled by a documented fallback (§5), revisited in v6.
- New authored levels; flood/line tools; reachability; runtime (still v6+).

## 3. (a) Horizontal platform tiles

The vertical set rotated 90° clockwise yields the horizontal caps (rim faces
named by the rocky edge):

| Horizontal tile | Source (vertical) | Rotation | Rim faces |
|-----------------|-------------------|----------|-----------|
| `platform_left` | `platform_bottom` (20) | 90° CW | left + top + bottom |
| `platform_mid_h` | `platform_mid` (12) | 90° | top + bottom |
| `platform_right` | `platform_top` (4) | 90° CW | right + top + bottom |

**Recommended: rotate at draw time**, not new assets. The renderer blits the
existing atlas tile through a canvas transform (`save/translate/rotate`).
Rationale: no atlas/`tiles.json` churn, no asset duplication to keep in sync,
and it is literally "rotate the vertical ones." A `drawTile` variant takes a
quarter-turn count.

Alternative (rejected as default): bake rotated PNGs into `tiles/` + extend
the atlas. More inspectable but duplicates pixels and grows the atlas for no
visual gain. May still emit rotated PNGs into `tiles/` *for documentation
parity only* (not used by the renderer).

## 4. (b) Thin-run tile selection

Definitions for a solid cell (`solid()` already counts off-grid as solid,
v4 §3). "Open" = the neighbour is not solid.

- **vertical thin**: `left` open **and** `right` open → part of a 1-wide
  column. Pick by up/down:
  - up open → `platform_top` (4)
  - up solid & down solid → `platform_mid` (12)
  - down open → `platform_bottom` (20)
- **horizontal thin**: `up` open **and** `down` open → part of a 1-tall
  row. Pick by left/right (rotated set):
  - left open → `platform_left`
  - left solid & right solid → `platform_mid_h`
  - right open → `platform_right`
- **otherwise**: the existing v4 9-slice rule, unchanged.

### Precedence & the 1×1 case

A lone cell open on all four sides satisfies *both* thin conditions and the
atlas has no all-caps tile. Decision: **horizontal takes precedence**, and a
length-1 isolated cell falls back to the v4 9-slice result (today: a corner
tile) — rare, acceptable, and flagged for a dedicated v6 tile. Documented as a
known limitation, not silently wrong.

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

- **Tile selection becomes a descriptor, not a bare index.** `autotileIndex`
  returns a number; a rotated tile can't be expressed that way. Introduce
  `pickTile(grid,r,c) → { index, quarter }` (`quarter` ∈ 0..3). The v4
  9-slice path returns `quarter:0`; thin-horizontal returns the vertical
  source index + the rotation from §3. `autotileIndex` stays (delegates) so
  existing tests/behaviour are preserved.
- **`renderer.js`** — call `pickTile`; blit with rotation; skip decor for
  thin cells. Stays pure (no DOM reads).
- **`tileset.js`** — `drawTile(ctx,index,dx,dy,size,quarter=0)`: for
  `quarter!==0`, `save → translate(centre) → rotate → drawImage → restore`.
- **`level.js` / `validate.js`** — untouched.
- **Tests** — `pickTile` is pure: unit-test vertical/horizontal runs, the
  caps vs. middle, the boundary non-trigger, and the 1×1 fallback. Rotation
  blit is dev-smoke + render-harness verified (no automated canvas test, as
  since v2).

## 6. Milestones

| # | Deliverable |
|---|-------------|
| 1 | `pickTile` descriptor + thin-run rules + unit tests; `autotileIndex` delegates (no behaviour change for thick walls) |
| 2 | `tileset.js` rotated-blit; `renderer.js` uses `pickTile`, suppresses decor on thin cells |
| 3 | Re-verify both example levels via the render harness; refresh `v4_preview/`-style shots |
| 4 | Docs + v05 transcript; update v4 §4 reference (superseded); platform note in `data/levels/README.md` |

## 7. Open questions

- **Grass on thin platforms** — fully suppress decor (recommended, cleaner),
  or still allow grass tufts on the top of a horizontal platform for the
  sky theme? Needs a visual check.
- **1×1 isolated cell** — accept the 9-slice fallback for v5, or pull a
  dedicated "nub" tile forward into v5? Recommend defer.
- **`platform_mid_h` orientation** — confirm the 90° direction (CW vs CCW)
  against the actual pixels; the rim is vertically symmetric so either works
  for mid, but the caps must match the run direction. Verify in milestone 2.
- **2-thick runs** — explicitly unchanged (only exactly-1-thick is "thin");
  confirm this reads correctly where a thin platform meets a thick mass.

## 8. Acceptance criteria

- A free-floating 1-wide vertical pillar renders `platform_top` / repeated
  `platform_mid` / `platform_bottom`.
- A free-floating 1-tall horizontal ledge renders `platform_left` /
  `platform_mid_h` / `platform_right` (rotated set).
- Thick walls and boundary walls are byte-for-byte unchanged from v4
  (`autotileIndex` delegation proven by the existing tests still passing).
- No new image assets are required by the renderer (draw-time rotation).
- `pickTile` is pure and unit-tested; `npm test` green, `npm run build`
  clean; example levels re-verified.

## 9. v6 candidates

Dedicated 1×1 platform/nub tile; per-tile variant randomisation; flood fill +
line tool; reachability lint; play-test runtime (long-standing, v2 §6).
