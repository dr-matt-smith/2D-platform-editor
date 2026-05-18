# 2D Level Designer — Version 7 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version06_design.md](version06_design.md)

> Numbered **v7**: v6 ("three loadable levels") is delivered. The request
> said "level 6"; this is the next version.

## 1. Purpose

Make tilesets data-driven and swappable, and surface tiles visually in the
editor:

- a per-tileset **`tile_lookup.json`** that maps roles → { name, char,
  image } so the glyph alphabet and the render tiles are data, not hardcoded;
- the right-hand **legend shows a thumbnail** of each tile beside its glyph
  and name; rename **"Wall" → "Filled"** (empty / filled = the two basics);
- a generated **tilesets manifest**; a per-level **`# tileset:`** directive;
- a **"New empty level"** flow that picks a tileset.

## 2. Current state (what is hardcoded today)

- `level.js` `LEGEND` — 6 fixed glyphs (`.` empty, `#` **wall**, `P`, `^`,
  `o`, `E`). Drives the legend UI and `validate.js`'s undefined-glyph rule.
- `renderer.js` — `T.dirt` 9-slice indices, `PLATFORM` set
  `{4,12,20,24,25,26,27}`, `pickTile` returns a **numeric Dirt-atlas index**.
- `tileset.js` — `GLYPH_TILE {'#':9}`, hardcoded atlas + 4 standalone
  Dirt paths.
- One tileset dir; `tiles.json` exists (28 sliced tiles: index/name/role/
  file). **No** `tile_lookup.json`, no tilesets manifest, no `# tileset:`
  directive, no new-level flow (the loader only opens existing levels).

Everything above is Dirt-specific. v7 introduces a role layer so a different
tileset is a data drop-in.

## 3. Two concepts the request conflates (must be separated)

The brief lists one flat set of "tiles", but there are really two layers:

1. **Glyph alphabet** — what the user types/draws and what the level text
   stores: `empty`, `filled`, `player`, `exit`, `hazard<n>`, `pickup<n>`.
   Each has a **distinct char** and drives the legend + validation.
2. **Render roles** — auto-selected *sub-tiles of `filled`* chosen by
   `pickTile` from neighbours: `filled-top/bottom/left/right`,
   `filled-center-horizontal/vertical`, the 9-slice **corners**, and
   `filled-single`. These all share the char `#`; they differ only by image.

`tile_lookup.json` holds **both** (one entry per role); the legend renders
only layer 1; the renderer resolves layer 2. Keeping them in one file is
fine, but the design must not pretend a render-role has its own editable
char.

## 4. `tile_lookup.json` schema

`public/data/tilesets/<set>/tile_lookup.json`:

```json
{
  "roles": {
    "empty":   { "name": "Empty",  "char": ".", "image": null },
    "filled":  { "name": "Filled", "char": "#", "image": "tiles/09_dirt_center.png" },

    "filled-top":            { "name": "Filled (top)",    "char": "#", "image": "tiles/01_dirt_top.png" },
    "filled-bottom":         { "name": "Filled (bottom)", "char": "#", "image": "tiles/17_dirt_bottom.png" },
    "filled-left":           { "name": "Filled (left)",   "char": "#", "image": "tiles/08_dirt_left.png" },
    "filled-right":          { "name": "Filled (right)",  "char": "#", "image": "tiles/10_dirt_right.png" },
    "filled-top-left":       { "char": "#", "image": "tiles/00_dirt_top_left.png" },
    "filled-top-right":      { "char": "#", "image": "tiles/02_dirt_top_right.png" },
    "filled-bottom-left":    { "char": "#", "image": "tiles/16_dirt_bottom_left.png" },
    "filled-bottom-right":   { "char": "#", "image": "tiles/18_dirt_bottom_right.png" },
    "filled-center-vertical":   { "char": "#", "image": "tiles/12_platform_mid.png" },
    "filled-center-horizontal": { "char": "#", "image": "tiles/25_platform_mid_h.png" },
    "filled-single":         { "char": "#", "image": "tiles/27_platform_single.png" },

    "empty-sky":   { "name": "Sky",  "image": "tiles/11_sky.png" },
    "empty-cave":  { "name": "Cave", "image": "tiles/19_dirt_fill.png" },

    "player": { "name": "Player spawn", "char": "P", "image": null },
    "exit":   { "name": "Exit",         "char": "E", "image": null },
    "hazard":  { "name": "Hazard",  "char": "^", "image": null },
    "pickup":  { "name": "Pickup",  "char": "o", "image": null }
  }
}
```

Notes / decisions:

- **Corners are required.** The user's list omitted the four corners and
  `filled-single`; the renderer needs them (full 9-slice + v5 platform set).
  They are added with `filled-*` names. **Open question §11** confirms the
  exact naming; the *count* is non-negotiable.
- `char` is **optional** for render-only roles (all `filled-*` share `#`;
  only `filled` carries the editable char). Legend = roles that have a
  `char`. Renderer = the `filled-*` set.
- `image: null` = no sprite (Dirt has none for player/exit/hazard/pickup);
  the renderer keeps its existing coloured-shape fallback, and the legend
  shows that shape as the thumbnail.
- `hazard<n>` / `pickup<n>`: `hazard` is the default; `hazard1`, `hazard2`…
  are optional extra variants (distinct chars, e.g. `^`, then author-chosen).
  v7 ships only the defaults; the schema *allows* the numbered series.
- `tiles.json` (raw slice manifest) stays; `tile_lookup.json` is the
  semantic layer on top. A small generator can scaffold a lookup from
  `tiles.json` by role-name match, hand-tuned thereafter.

## 5. Renderer role layer (the load-bearing refactor)

`pickTile` currently returns a Dirt-atlas integer. v7: it returns a **role
key string** (`'filled-top'`, `'filled-single'`, `'filled'`, …). A
tileset-bound resolver maps role → image (from `tile_lookup.json`) and blits
it; `tileset.js` becomes generic (loads the images named in the lookup, keyed
by role). The neighbour logic of `autotileIndex`/`pickTile` is unchanged —
only its *return type* changes (index → role). A Dirt `tile_lookup.json`
that reproduces today's exact index→role mapping is the regression guard
(rendered output must be byte-identical to v6 for the example levels).

`level.js` `LEGEND` is **derived** from the active tileset's lookup (roles
with a `char`), not hardcoded. `validate.js`'s valid-glyph set likewise comes
from the lookup → validation becomes tileset-aware.

## 6. Per-level tileset + manifest

- **`# tileset:`** — additive header directive (like `theme`/`order`);
  default `Dirt_Platformer_Tiles`. Existing levels (no directive) keep
  rendering Dirt. The parser already consumes unknown directives, but the
  app must *read* this one to pick the lookup.
- **Tilesets manifest** — `scripts/gen-tilesets-manifest.mjs` scans
  `public/data/tilesets/*/tile_lookup.json` → `public/data/tilesets/
  manifest.json` (`[{ id, name }]`), wired into `predev`/`prebuild` exactly
  like `gen-levels-manifest`.

## 7. Legend thumbnails + rename

- Right-pane legend: each entry = small tile image + char + name. Image from
  the role's `image` (scaled down); `null` → the renderer's shape swatch.
- "Wall" → **"Filled"** (the `#` role name). `empty`/`filled` presented as
  the two basic types. Cosmetic in the data (the char stays `#`); touches the
  lookup, the legend render, and any doc copy.

## 8. New empty level

Loader dialog gains a **"New level"** action → choose a tileset (tilesets
manifest) → choose size → buffer = a grid of the tileset's `empty` char with
`# name:`, `# size:`, `# tileset:` headers. It is *not* auto-saved (no id
until the user downloads/keeps it); validation will warn "no player spawn"
until they place one — expected.

## 9. Architecture / impact (large — phased)

| Area | Change |
|------|--------|
| `tile_lookup.json` (Dirt) | new; reproduces current mapping exactly |
| `renderer.js` | `pickTile`/`autotileIndex` return role keys; resolver blits via lookup |
| `tileset.js` | generic loader keyed by lookup roles (not hardcoded paths) |
| `level.js` | `LEGEND` derived from active lookup; `# tileset:` parsed to `meta.tileset` |
| `validate.js` | valid-glyph set from the active lookup |
| `main.js` | legend thumbnails; pass active tileset to renderer; new-level flow |
| `loaderDialog.js` | "New level" + tileset chooser |
| `scripts/` | `gen-tilesets-manifest.mjs`; predev/prebuild wiring |

This is the biggest refactor since v1 — it re-types the renderer's core
return value and makes three modules tileset-aware. **Recommended phasing**
(could span v7→v8 if preferred; one coherent design, sequenced):

1. Add Dirt `tile_lookup.json` + `gen-tilesets-manifest`; **no behaviour
   change** (data only, regression-guarded).
2. Renderer role-key refactor behind the Dirt lookup; prove byte-identical
   render of the example levels (the hard regression gate).
3. `LEGEND`/`validate` derived from the lookup; rename Wall→Filled.
4. Legend thumbnails.
5. `# tileset:` directive + reading it; tileset chooser; new-level flow.

## 10. Migration / back-compat

- Levels with no `# tileset:` → default `Dirt_Platformer_Tiles`; render
  unchanged.
- Glyph chars are unchanged (`.`/`#`/`P`/`E`/`^`/`o`) so existing level text,
  drafts, and `localStorage` are unaffected — no migration.
- `tiles.json` retained; `tile_lookup.json` is additive.

## 11. Open questions

- **Role naming (blocking phase 2).** Confirm names for the four corners and
  the single (`filled-top-left` … `filled-single`?), and whether
  `filled-center-horizontal/vertical` mean the v5 platform mids (assumed
  yes). The renderer needs *some* name for all 9-slice + platform cases; the
  request's 7-name set is insufficient — this doc proposes a 13-role
  `filled-*` set (§4).
- **Scope/phasing.** This is ~2 versions of work. Ship all of v7, or land
  phases 1–2 as v7 and 3–5 as v8? Recommend deciding before phase 1.
- **`empty` variants vs `# theme:`.** Today sky/cave bg is chosen by
  `# theme:`. The lookup has `empty-sky`/`empty-cave`. Keep `# theme:`
  selecting which `empty-*` image (recommended, no format churn) rather than
  a new mechanism.
- **Hazard/pickup numbering in the editor.** v7 ships defaults only; how the
  user picks `hazard2` vs `hazard` in the editor (distinct chars? a palette
  sub-menu?) is deferred — schema allows it, UI is v8.
- **Tileset image-less roles.** Dirt has no player/exit/hazard/pickup
  sprites; confirm keeping coloured-shape fallback (recommended) vs.
  requiring every tileset to supply them.

## 12. Acceptance criteria

- `public/data/tilesets/Dirt_Platformer_Tiles/tile_lookup.json` exists and a
  generated `public/data/tilesets/manifest.json` lists it (via the hook).
- With the Dirt lookup, the example levels render **byte-identical to v6**
  (regression gate for the role-key refactor).
- Legend shows a thumbnail + char + name per glyph; `#` reads **"Filled"**.
- A level with `# tileset: Dirt_Platformer_Tiles` (or none) is unchanged; the
  app reads the directive to select the lookup.
- "New level" produces an empty, correctly-headed buffer for a chosen
  tileset; `npm test` green, `npm run build` clean.

## 13. v8 candidates

Hazard/pickup variant picker UI; a second real tileset (proving the
abstraction); per-tile variant randomisation; flood/line tool; reachability
lint; play-test runtime; level create/rename/delete.
