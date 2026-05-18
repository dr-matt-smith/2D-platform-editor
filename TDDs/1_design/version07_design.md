# 2D Level Designer — Version 7 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version06_design.md](version06_design.md) · Supersedes earlier v7 draft
(ad-hoc `filled-*` names → mask model; UX/format split to v8)

> Numbered **v7**: v6 ("three loadable levels") is delivered. The request
> said "level 6"; this is the next version. The original v7 brief is split:
> **v7 = data + tile-selection engine** (this doc); **v8 = UX/format**
> (legend thumbnails, Wall→Filled, `# tileset:`, new-level + chooser — §13).

## 1. Purpose

Make tile selection a **standard 4-neighbour bitmask autotile** backed by a
per-tileset **`tile_lookup.json`**, replacing the bespoke
`pickTile`/`autotileIndex`/`PLATFORM`/`platform_single` code with one
16-entry table. v7 is **data + engine only, zero behaviour change**: the
example levels must render byte-identical to v6. Everything user-facing
(legend thumbnails, the Wall→Filled rename, the `# tileset:` directive, the
new-empty-level flow) moves to **v8** (§13).

## 2. Why the split

The original brief bundled four independent risk types: a core renderer
re-type, a format change (`# tileset:`), UI (thumbnails, new-level), and
build tooling. The renderer change is the biggest since v1 and needs its own
regression gate; bundling it with UX/format means any failure blocks
everything. v7 isolates the engine refactor (provable, no visible change);
v8 builds UX on the now-data-driven engine.

## 3. Current state — we already hand-rolled a 16-tile autotile

`renderer.js` uses `T.dirt` (9-slice indices), a `PLATFORM` set, and
`pickTile` (isolated/thin special cases) delegating to `autotileIndex`
(off-grid solid, v4). Enumerated, the 4 cardinal neighbours give **16
masks**, and every one already maps to exactly one current tile (corners +
edges + center + the v5 platform caps/mids + single). We reinvented 4-bit
("Wang"/Godot *3×3 minimal*/RPG-Maker-autotile) selection with bespoke names
and special cases. v7 adopts the standard.

## 4. The mask model (this table IS the spec and the regression gate)

Bit order (clockwise NESW): `mask = N·1 + E·2 + S·4 + W·8`, where a direction
bit is **1 if that neighbour is solid**. Off-grid counts as solid (v4 §3,
unchanged) — it only affects how the mask is computed at borders.

| mask | bin (WSEN) | solid neighbours | role label | Dirt tile (v6 index / name) |
|----:|:----------:|------------------|------------|------------------------------|
| 0  | `0000` | —          | `single`    | 27 `platform_single` |
| 1  | `0001` | N          | `cap-bottom`| 20 `platform_bottom` |
| 2  | `0010` | E          | `cap-left`  | 24 `platform_left`   |
| 3  | `0011` | N E        | `corner-bl` | 16 `dirt_bottom_left`|
| 4  | `0100` | S          | `cap-top`   | 4 `platform_top`     |
| 5  | `0101` | N S        | `mid-v`     | 12 `platform_mid`    |
| 6  | `0110` | E S        | `corner-tl` | 0 `dirt_top_left`    |
| 7  | `0111` | N E S      | `edge-left` | 8 `dirt_left`        |
| 8  | `1000` | W          | `cap-right` | 26 `platform_right`  |
| 9  | `1001` | N W        | `corner-br` | 18 `dirt_bottom_right`|
| 10 | `1010` | E W        | `mid-h`     | 25 `platform_mid_h`  |
| 11 | `1011` | N E W      | `edge-bottom`| 17 `dirt_bottom`    |
| 12 | `1100` | S W        | `corner-tr` | 2 `dirt_top_right`   |
| 13 | `1101` | N S W      | `edge-right`| 10 `dirt_right`      |
| 14 | `1110` | E S W      | `edge-top`  | 1 `dirt_top`         |
| 15 | `1111` | N E S W    | `center`    | 9 `dirt_center`      |

Naming follows the *decorated/open* side (consistent with the existing
`dirt_left` etc.): a cell solid on all but its left presents its face left →
`edge-left`; a cell whose only neighbour is below connects downward only →
it is the `cap-top` of a column. This 1:1 table is exactly today's output,
so the refactor is mechanical and exactly verifiable.

The `role label` column is human reference; the **canonical key is the mask
integer 0–15** (the standard, language-neutral, self-checking key — Tiled
/Godot store terrains this way internally).

## 5. `tile_lookup.json` schema

`public/data/tilesets/<set>/tile_lookup.json`:

```json
{
  "name": "Dirt Platformer Tiles",
  "tile": 32,
  "filled": {
    "0":  { "role": "single",     "image": "tiles/27_platform_single.png" },
    "1":  { "role": "cap-bottom", "image": "tiles/20_platform_bottom.png" },
    "2":  { "role": "cap-left",   "image": "tiles/24_platform_left.png" },
    "...": "…all 16 masks (see §4 table)…",
    "15": { "role": "center",     "image": "tiles/09_dirt_center.png" }
  },
  "background": {
    "sky":  { "image": "tiles/11_sky.png" },
    "cave": { "image": "tiles/19_dirt_fill.png" }
  },
  "glyphs": {
    "empty":  { "name": "Empty",        "char": "." },
    "player": { "name": "Player spawn", "char": "P", "image": null },
    "exit":   { "name": "Exit",         "char": "E", "image": null },
    "hazard": { "name": "Hazard",       "char": "^", "image": null },
    "pickup": { "name": "Pickup",       "char": "o", "image": null }
  }
}
```

- **`filled`** — the 16-mask table. Consumed by the v7 renderer.
- **`background`** — `# theme:` selects `sky` vs `cave` (no format change;
  reuses the v2 directive).
- **`glyphs`** — the editable alphabet (the `#` "filled" glyph is implicit:
  every `filled` mask shares char `#`). **Authored in v7** so the file is
  complete, but **consumed in v8** (derived `LEGEND`, validation, thumbnails,
  Wall→Filled, new-level). v7 does not change `level.js` `LEGEND`.
- `image: null` ⇒ no sprite; renderer keeps its coloured-shape fallback (Dirt
  has none for player/exit/hazard/pickup). `hazard1/2…`, `pickup1/2…` are
  permitted extra keys; v7 ships defaults only.
- A scaffold generator can seed `filled` from `tiles.json` using the §4
  table; hand-checked thereafter.

## 6. Engine refactor (v7 code)

- **New `tileMask(grid, r, c) → 0..15`** (pure): the four `solid()` checks
  (off-grid solid, unchanged) packed per §4 bit order. Replaces the
  neighbour logic inside `autotileIndex`/`pickTile`.
- **Resolver** in `tileset.js`: load the images named in
  `tile_lookup.json.filled` keyed by mask; `drawFilled(ctx, mask, …)` blits
  `filled[mask]`. Generic — no Dirt-specific paths, no atlas-index maths for
  these (the standalone PNGs are already the source of 24–27; v7 makes *all*
  16 lookup-driven; the 9-slice ones can stay atlas-backed via a small
  `atlas:"r,c"` form or be pre-sliced — see §11).
- **`renderer.js`**: terrain pass computes `tileMask` and draws via the
  resolver. Decor suppression keeps today's behaviour: suppress grass/drip
  when the mask is "thin" — `THIN = {0,1,2,4,5,8,10}` (single, the four caps,
  `mid-v`, `mid-h`) — exactly the old `PLATFORM` set, re-expressed.
- `autotileIndex`/`pickTile`/`PLATFORM` are **removed**; their tests are
  rewritten as a `tileMask` table test (all 16) + a Dirt-lookup mapping test
  (mask → the v6 index in §4) — these two together *prove* byte-identical
  output without rendering.
- `level.js`/`validate.js`/`main.js`/`loaderDialog.js` — **unchanged in v7**.

## 7. Tilesets manifest (v7, build tooling)

`scripts/gen-tilesets-manifest.mjs` scans
`public/data/tilesets/*/tile_lookup.json` → `public/data/tilesets/
manifest.json` (`[{ id, name }]`), wired into `predev`/`prebuild` exactly
like `gen-levels-manifest`. It has **no consumer until v8**; included in v7
because it is zero-risk data tooling that completes the "tilesets are
discoverable data" layer. (Alternative: defer to v8 with its consumer — §11.)

## 8. Architecture / impact (v7 only)

| Area | Change |
|------|--------|
| `tile_lookup.json` (Dirt) | new; `filled` reproduces §4 exactly |
| `renderer.js` | `tileMask` + resolver; remove `pickTile`/`autotileIndex`/`PLATFORM`; decor uses `THIN` |
| `tileset.js` | generic mask→image loader from the lookup |
| `renderer.test.js` | rewritten: 16-mask table test + Dirt mapping test |
| `scripts/` | `gen-tilesets-manifest.mjs` + predev/prebuild |
| `level.js`/`validate.js`/`main.js`/`loaderDialog.js` | **unchanged** |

## 9. Migration / back-compat

- No glyph, format, `LEGEND`, or localStorage change in v7 → existing levels,
  drafts, `lastOpen` unaffected.
- The regression gate is exact (the §4 table); example levels render
  byte-identical to v6 (verified by the render harness + the two unit
  tests).
- `tiles.json` retained; `tile_lookup.json` and the tilesets manifest are
  additive.

## 10. Milestones (v7)

All milestones delivered — see
[../2_implementation/version07_implementation.md](../2_implementation/version07_implementation.md)
for commit hashes.

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | `tileMask` (pure, 0–15) + 16-case table test; remove old fns; renderer/tests still green & render-identical | done |
| 2 | Dirt `tile_lookup.json` (§4/§5) + `tileset.js` mask→image resolver; renderer draws via lookup; harness byte-compare vs v6 | done |
| 3 | `gen-tilesets-manifest.mjs` + predev/prebuild; `manifest.json` committed | done |
| 4 | Docs + v07 transcript; mark plan delivered | done |

## 11. Open questions

- **9-slice tiles: keep atlas-backed or pre-slice all 16?** 24–27 are
  standalone PNGs; 0–18 live in the atlas. Cleanest is one mechanism: either
  `tile_lookup` entries allow `{ "atlas": "row,col" }` *or* the slicer emits
  all 16 as PNGs (it already emits per-tile PNGs in `tiles/`). Recommend the
  latter (uniform, simplest resolver). Decide before milestone 2.
- **Tilesets manifest in v7 or v8?** §7 puts it in v7 (zero-risk data). It
  has no consumer until v8 — acceptable, or defer. Recommend v7.
- **Bit order.** NESW clockwise, `N=1…W=8` (§4) — documented convention; any
  consistent order works, but it must be fixed now since it keys the file.
- **`glyphs` section authored in v7?** Yes (file completeness), consumed v8.
  Confirm we are happy shipping authored-but-unconsumed data.
- **Future: 8-neighbour / 47-blob.** This is the 4-bit/16 subset (no diagonal
  info → no inner corners), consistent with today. A future tileset wanting
  true inner corners would need the 47-tile "blob" superset; the schema can
  extend (`filled` keyed by an 8-bit mask) without breaking 16-key sets.
  Out of scope; noted so the schema choice is deliberate.

## 12. Acceptance criteria (v7)

- `tileMask` returns the §4 mask for all 16 neighbour combinations (unit
  test); off-grid still counts as solid.
- Dirt `tile_lookup.json.filled[mask].image` equals the v6 tile for every
  mask (mapping test) ⇒ example levels render **byte-identical to v6** (the
  scratch + `above_ground`/`below_ground` harness shots).
- `pickTile`/`autotileIndex`/`PLATFORM` are gone; nothing imports them.
- Generated `public/data/tilesets/manifest.json` lists
  `Dirt_Platformer_Tiles` via the hook (not hand-edited).
- `npm test` green, `npm run build` clean.

## 13. v8 scope (recorded so the split is unambiguous)

Consumes the v7 data layer; no engine risk:

- `level.js` `LEGEND` **derived** from the active tileset's `glyphs`;
  `validate.js` valid-glyph set from the lookup.
- **Wall → Filled** (the `#`/filled glyph label); empty/filled as the two
  basics.
- **Legend thumbnails** — small tile image (from the lookup) + char + name.
- **`# tileset:`** additive header directive (default `Dirt_Platformer_Tiles`,
  no migration); app reads it to choose the lookup.
- **New empty level** + tileset chooser (uses the v7 tilesets manifest).
- Deferred further: hazard/pickup variant picker UI; a second real tileset
  (proves the abstraction); 47-blob; flood/line tool; reachability lint;
  play-test runtime.
