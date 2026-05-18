# Transcript — Version 5: Single-Tile Platforms

A narrative record of the v5 phase: making 1-cell-thick walls render as
purpose-built platforms. Decisions and rationale, in order.

## Two design reversals from the user

The first draft proposed **draw-time rotation** of the vertical platform tiles
to get the horizontal set — optimised for "no new assets." The user pushed
back: wouldn't separate image files be simpler than carrying rotation in the
logic? They were right. Pre-baking keeps tile selection a plain integer end to
end (no `{index, quarter}` descriptor rippling through selection → renderer →
tests); the rotation cost collapses to one offline step. The design
recommendation was flipped, not defended.

Then the user pulled the **1×1 isolated tile** into scope (the draft had
deferred it to v6), suggesting it be composed from half of the left cap and
half of the right cap with the seam patched. That became `platform_single`
(27). Both reversals improved the design; the doc was rewritten to match
rather than bolted onto.

## Build

Four milestones, one commit each, path-scoped `git add` throughout.

1. `pickTile` — pure, returns a plain index: isolated 1×1 → 27, 1-wide
   column → 4/12/20, 1-tall row → 24/25/26, else **delegate to
   `autotileIndex`**. The delegation made the entire v4 autotile test suite
   the regression guard for thick/boundary walls — it stayed green untouched.
2. `scripts/gen-platform-tiles.py` — 90° CW transposes (exact, no resampling)
   plus the composed single with a 6 px `mid_h` seam patch. `tiles.json`
   extended *additively*; an md5 of entries 0–23 before/after proved them
   byte-identical (the plan's flagged risk, closed). `tileset.js` went async
   to load the four standalone PNGs and source indices ≥ 24 from them.
3. Wired `pickTile` into the renderer; recorded platform cells in a
   per-render `Set` so the decor pass leaves their finished art alone.

## Showing it works

The one real unknown — the `platform_single` seam — was settled by rendering
a contact sheet: the `mid_h` patch masked the join cleanly, so the §7 fallback
(wider blend / four-quadrant) was not needed. A purpose-built **scratch**
level (a floating pillar, a floating ledge, a lone cell) confirmed the new
tiles and the decor suppression. `above_ground` and `below_ground` rendered
**byte-identical** to their v4 look — real regression evidence, since both are
built from ≥2-thick walls and never trigger the new path.

## Outcome

Tests 47 → 52, build clean throughout. The selection logic is unit-tested;
tiles, seam and integration are render-harness verified (no automated canvas
test — the same honest gap carried since v2). v4 §4's 1-deep treatment is
marked superseded; the depth *authoring guidance* still stands, only the
rendered tiles changed.
