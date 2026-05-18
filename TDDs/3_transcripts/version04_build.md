# Transcript — Version 4: Tile Faces & the Rectangle Tool

A narrative record of the v4 phase: correcting which way the dirt faces, and
adding a rectangle draw tool. Decisions and rationale, in order.

## The observation that collapsed to one line

The brief read like a big change: above-ground's dirt should be the *outside
frame of a rectangle*, with the rocky face toward the player — left wall
`dirt_right`, right wall `dirt_left`, floor `dirt_top`, ceiling
`dirt_bottom`. Working each case against the existing 9-slice rule showed they
all fall out of a single flip: **treat off-grid neighbours as solid** instead
of open. The world becomes implicit dirt the level is carved from; nothing
else in `autotileIndex` changes, and non-boundary structures are untouched
because the change only affects cells whose neighbour is off the grid.

## Showing, not asserting

The one real risk was below-ground (its 2-thick outer ring would lose edge
tiles). Rather than argue from theory, both levels were rendered old-vs-new.
First attempt: the images were shown via the read tool, which the user
couldn't see — corrected by writing labelled composites into a git-ignored
`v4_preview/` and opening them. The renders confirmed below-ground's *played*
interior is byte-identical and only a redundant off-screen frame is dropped.
The user chose the single global rule; theme-gating was deleted from the
design, not deferred.

## Build

Plan first (user's call: plan only, then review), then five milestones, one
commit each, path-scoped `git add` throughout (the v3 `-A` incident still
informs this):

1. The one-line rule + a **rewritten** test — the old 9-slice test asserted
   the previous off-grid-open behaviour, so it had to change, not just grow.
   Verified against the real levels through the actual renderer, not only the
   Python mirror.
2. Pure `fillRect` / `outlineRect` in `level.js` — corner-normalised,
   clamped, immutable, dimension-preserving; unit-tested headless.
3. `history.js` — capped whole-buffer undo/redo, redo-branch drop,
   `undo(current)` commits a pending edit so Ctrl+Z always steps back from
   what's on screen. Keys are `preventDefault`ed so native textarea undo
   can't diverge — the coexistence risk, owned rather than reconciled.
4. The rectangle tool: an overlay canvas for the marquee (keeps `draw()`
   pure), the legend repurposed as a glyph picker (no new toolbar chrome).
   The flagged risk — splicing edits back through the header/comments — was
   handled by writing each changed row at its original `parsed.rows[i].line`,
   and verified out-of-app against a level with a `//` comment between grid
   rows.

## Outcome

Tests 26 → 47, build clean throughout. The rule change is render-verified and
the splice is logic-verified; the drag interaction itself remains
dev-smoke-level (no automated DOM harness — the same honest gap carried since
v2). A consequence to remember: the first rectangle edit normalises ragged
grid rows to full width (parser padding) — expected, and consistent with what
the renderer and validator already consume.
