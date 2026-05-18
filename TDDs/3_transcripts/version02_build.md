# Transcript — Version 2: Tiles, Levels, Autotiling, Theme

A narrative record of the v2 phase: turning the flat v1 preview into something
that looks like the source screenshots. Decisions and rationale, in order.

## Reading the tileset

Two screenshots (`above_ground.png`, `below_ground.png`) and the atlas were
inspected. Rather than guess the layout, the atlas was upscaled with a 32 px
grid overlay and each tile profiled by alpha/colour. This **confirmed** the
design §8 open question: 32×32, 8×3, a classic 9-slice dirt block plus solid
sky, a moon, and ~95%-transparent overlays (stars, grass, stalactite, drip).

## Slicing

A one-shot Python/PIL script sliced 24 tiles to `tiles/NN_name.png` with
semantic names derived from the pixel analysis (not guesses) and a `tiles.json`
manifest. A labelled contact sheet was rendered and visually checked before
committing. The script is not part of the app bundle and is re-runnable if the
atlas is replaced.

## Authoring two levels

`above_ground` and `below_ground` were authored in the v1 format. They were
**generated programmatically** so every row is exactly the declared width, and
validated with the project's *own* `parse`+`validate` (the authoritative
check) — zero errors. Two bugs were caught and fixed during authoring: a
`rect()` argument-order mistake, and a walled-off exit in the cave found by
inspection (v1 has no reachability lint, so the validator did not catch it —
recorded as a known gap).

## Autotiling

The renderer was rewritten as a pure four-pass draw: themed background,
9-slice autotiled dirt, decor, entities. The autotile rule reduces the four
neighbours to a row/col into the 9-slice, with off-grid treated as open so map
borders render as rocky edges. `autotileIndex` was exported and unit-tested
independently of any canvas. Decor (grass, drips, stars, moon) is
**position-hashed** so it never flickers between renders — keeping `draw`
deterministic was a hard requirement.

## The theme decision

Rendering revealed a real fidelity problem: the cave level came out as blue
night sky with a moon, because the format had no notion of a level's visual
theme. This was a format-affecting decision, so it was put to the user with
options (explicit directive vs. density heuristic vs. leave-as-is). The user
chose an **additive `# theme:` directive** (`sky` default | `cave`). It was
threaded through parse, serialize (round-trips, v1 byte-identical), and the
renderer; `below_ground.txt` was set to `cave`. A re-render confirmed the cave
now reads as a dark dirt cave with drips and no celestial decor.

## Outcome

Tests 14 → 20, clean build, both levels still validate at zero errors, and
both render close to their screenshots (verified via a faithful out-of-app
re-implementation of the renderer logic — an in-browser snapshot test remains
unscoped). Autotiling + decor were pulled forward from the v2 backlog (#6);
rectangle fill, a play-test runtime, and a reachability lint remain planned.
