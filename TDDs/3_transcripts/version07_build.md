# Transcript — Version 7: Mask-Model Tile Engine

A narrative record of the v7 phase: replacing the bespoke tile-selection
code with a standard 4-neighbour bitmask autotile driven by data. Decisions
and rationale, in order.

## The brief was too big — and we'd already hand-rolled the standard

The first v7 draft (ad-hoc `filled-*` names, plus legend thumbnails,
`# tileset:`, new-level flow) was written, then the user asked three sharp
questions: is this too much for one version, are the names reasonable, and
is there a standard convention. Answering honestly surfaced that
`pickTile` + `autotileIndex` + `PLATFORM` + `platform_single` is *exactly* a
16-state 4-bit autotile (Wang / Godot "3×3 minimal") built by hand. The
design was rewritten around the **mask model** and **split**: v7 = data +
engine (zero behaviour change, regression-gated); v8 = the UX/format work.
The user also asked for a binary `(WSEN)` column "for fun" — added; it makes
the structure legible at a glance (single `0000`, centre `1111`, the two
mids `0101`/`1010`).

## Build

- **M1** — `tileMask(grid,r,c) → 0..15` (NESW bits, off-grid solid). Removed
  the three old functions; an interim `MASK_INDEX` (§4 table, hand-verified
  against the old logic for all 16) kept pixels identical so M1 changed
  nothing visible and was provable by the mask test alone.
- **M2** — Dirt `tile_lookup.json` (`filled` keyed by mask), `tileset.js`
  rewritten to load the 16 lookup PNGs + `drawFilled(mask)`; atlas demoted
  to decor/bg only. `MASK_INDEX` deleted. The regression gate became **two
  unit tests** — `tileMask` (16 cases) + Dirt-mapping (lookup ↔ §4 index) —
  which together prove byte-identity *without rendering*, and so are immune
  to the user's mid-stream `below_ground` rewrite. A scratch lookup render
  confirmed visually.
- **M3** — `gen-tilesets-manifest.mjs` + a `gen` umbrella in `predev`/
  `prebuild`. One tileset; no consumer until v8 (intentional data layer).

## Git discipline, tested twice

Two near-misses, both caught and corrected: a 0-byte `above_ground2.txt`
the user's tooling pre-staged rode into the v7 design commit (`git commit`
commits the whole index, not just a path-scoped add) — amended out without
touching the file; and staging `below_ground.txt` to re-add `# order:`
swept the user's uncommitted cave rewrite into a thinly-titled commit — the
message was amended to state it honestly. The memory was updated: read
`git status` as its own step, unstage anything pre-staged you didn't create,
never revert a user file to "clean up". The user also kept authoring
`above_ground2.txt` throughout; it was left untracked and out of every v7
commit.

## Outcome

Tests 52 → 48 (old selector tests consolidated into the mask table +
behavioural tests), build clean, every milestone path-scoped. The engine is
now data-driven: a new tileset is a `tile_lookup.json` drop-in. v8 builds
the visible features (derived LEGEND, Wall→Filled, thumbnails, `# tileset:`,
new-level + chooser) on this layer with no engine risk.
