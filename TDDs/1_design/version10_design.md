# 2D Level Designer — Version 10 Design Document

Status: **Delivered** · Date: 2026-05-20 · Builds on:
[version09_design.md](version09_design.md) §14 (v10 candidates incl. "tile-
set rendering beyond Dirt") · Built:
[../2_implementation/version10_implementation.md](../2_implementation/version10_implementation.md)
(M1–M4, all §10 acceptance met) ·
[../3_transcripts/version10_build.md](../3_transcripts/version10_build.md)

## 1. Purpose

The editor visibly **renders only Dirt correctly**. A Playwright capture
[recorded in v9.5](../3_transcripts/version09_build.md) showed the three
non-Dirt preview canvases were byte-identical (md5 `2ba7f2c8…`) while their
legends were distinct — proving the **v8 decor-atlas limit** in practice.
v10 fixes that.

The fix is "Phase 1" of the user's tileset rework: render the editor
preview per-cell from the tileset's lookup, so each authored tileset shows
*its* art on the canvas (not just in the legend). The richer scope
(per-category variants, state-changing exit, decoration layer, sprite-
frame cropping, procedural-decor data) is mapped out in §11 for v11+.

## 2. Current state (what v10 changes)

- `tileset.js` `loadTileset()` returns `ready: !!image` where `image` is
  the **atlas** PNG (`platformertiles.png`). Only Dirt has one.
- `renderer.js` gates the *entire* engaged-rendering path on
  `if (ready)`. Off-path → every cell calls `drawFallback()` (a
  palette-driven shape per glyph). Result: every non-Dirt tileset renders
  IDENTICALLY (because `FALLBACK` doesn't read the active tileset at all).
- Entities (P/E/^/o) are drawn as shapes **always**, even with Dirt — the
  renderer never consults `glyphs[*].image`, even though the legend does.

The fix is two changes that together produce a per-cell fallback chain
authored by the tileset, not the renderer.

## 3. Categories — the model used here

Before naming fields, this is the taxonomy v10 commits to (the user's
analysis, condensed):

| Category | Behaviour | v10 status |
|---|---|---|
| **background** | non-solid backdrop | unchanged (`.`) |
| **terrain** | solid; player collides | the bug's blast radius — fixed §4 |
| **hazard** | lethal | unchanged (`^`); image-renderable §5 |
| **pickup** | collectable; counts toward win | unchanged (`o`); image-renderable §5 |
| **exit** | goal; transitions playtest | unchanged (`E`); image-renderable §5 |
| **decoration** | paintable, no gameplay effect | **deferred to v11** (§11) |

Multi-variant within a category (e.g. `o`/`O`/`&` all pickups), the
state-changing exit (`imageActive`), the decoration layer, and procedural-
decor data are all v11+ — they compose cleanly on top of v10 but are out
of scope here.

## 4. Schema: `terrain` (additive, back-compat)

Extend `tile_lookup.json` with one optional namespace:

```json
"terrain": {
  "default": { "image": "tiles/Block.png" },           // single-tile fallback
  "masks":   { "0": { "image": "..." }, …, "15": { … } } // OPTIONAL autotile
}
```

Reader resolution (in `tileset.js`):

1. `lookup.terrain.masks[m]?.image` — autotile picks per 4-neighbour mask.
2. else `lookup.terrain.default.image` — single-tile fallback.
3. else `lookup.glyphs.filled.image` — **legend thumbnail re-used**
   (most existing JSONs already declare this; means v10 needs **no data
   migration** for the four user tilesets — the renderer change alone
   produces a working result).
4. else colour shape from `palette.FALLBACK`.

**Back-compat for Dirt:** the legacy `lookup.filled` mask table is read
as `terrain.masks` (alias), so Dirt's existing JSON is byte-untouched and
its render is byte-identical. Migrating Dirt's JSON to the new shape is a
**non-goal** for v10 (the alias keeps both readable).

## 5. Renderer: per-cell, not per-tileset

Today: `if (ready)` gates the whole engaged path. After v10 the renderer
asks the lookup *per cell*, never gives up wholesale:

```text
background fill:      atlasReady ? blit sky tile : skip   (the SKY fillRect always runs)
terrain  (#):         terrainFor(mask) ?? drawFallback('#')
decor    (grass/…):   atlasReady only — Dirt-only (declared v8 limit)
entities (P/E/^/o):   entityFor(char) ?? drawFallback(char)
```

Two new accessors on the tileset object — both **null-safe / fully-loaded
or null**, so the renderer never deals with promises:

- `terrainFor(mask) → HTMLImageElement | null`
- `entityFor(char) → HTMLImageElement | null`

`atlasReady` replaces the now-misleadingly-named `ready` (kept as an alias
during v10 for safety; the renderer reads `atlasReady`). It gates **only
the decor pass** (Dirt-atlas-driven). Decor for other tilesets remains
**v11**: the fix is "every tileset renders distinctly", not "every tileset
renders with grass + moon".

## 6. Entities — read `glyphs[*].image`

`renderer.js` Pass 4 currently always draws shapes for entities. v10 uses
`tileset.entityFor(char)` (which resolves `lookup.glyphs[X].image` per
char); null → fall back to the existing shape. **No data change required
for the four new tilesets** — they already declare entity images for the
legend (`Pea-Standard.png`, `Mask Dude/Idle (32x32).png`,
`Gold Coin/01.png`, etc.). Dirt's entity glyphs declare `image: null`, so
Dirt entity rendering is byte-identical.

**Known cosmetic limit (declared, not a regression):** several of the
user's authored entity images are *animation sheets* (Apple is 17 frames
wide, Mask Dude 11). Drawn at TILE size they squash into a horizontal
strip — distinct per tileset (the bug is fixed) but ugly. **Sprite-frame
cropping** (`glyphs.<role>.frames` / `frame` index) is the right next
step and is reserved for v11 (§11), not crammed in here.

## 7. Architecture / impact

| File | Change |
|------|--------|
| `src/tileset.js` | parse `lookup.terrain.{default,masks}` (and legacy `lookup.filled` as alias); preload entity images by char; expose `terrainFor`, `entityFor`, `atlasReady`; keep `drawFilled`/`ready` as thin aliases for the M1 hand-off |
| `src/renderer.js` | lift the `ready` gate; per-cell fallback chain (§5); decor pass remains atlas-gated |
| `tests/tileset-screenshots.spec.js` | new assertion: preview hashes are *mutually distinct* across the manifest (the bug fails this today; v10 passes) |
| `src/level.js`, `src/validate.js`, `src/levels.js`, `src/play/*`, all `tile_lookup.json` files | **unchanged** |

**The pivotal claim:** v10 is a **renderer + loader** change. **Zero data
migration** for the four new tilesets — their existing `glyphs[*].image`
fields, originally authored for the legend, are now also read by the
preview canvas (§4 fallback chain step 3, §6). That's why the fix is so
small.

## 8. Back-compat

- Dirt's `tile_lookup.json` is **byte-untouched**. The renderer route
  through `terrainFor` returns the same Image instances for masks 0–15
  that `drawFilled` returned before, drawn via the same `drawImage` call
  signature → **byte-identical Dirt render**.
- `lookup.filled` (legacy) and `lookup.terrain.masks` (new) are read by
  the same code branch in `tileset.js`; tilesets can use either.
- Entity rendering with `image: null` (Dirt's pattern) routes to the
  unchanged shape fallback, so Dirt's player/exit/hazard/pickup shapes
  stay byte-identical.
- The playtest (`src/play/*`) and its sprites are completely untouched —
  v10 is editor-renderer only.

## 9. Open questions — RESOLVED

- **Rename or add?** — **Add `terrain.{default,masks}` and keep `filled`
  as a read-side alias**, not a rename. Rationale: Dirt's JSON is in the
  Dirt directory; a rename would force a Dirt-data commit just to keep
  green. Locked.
- **Where does the single-block image come from when a tileset hasn't
  authored `terrain.default`?** — **Fall back to `glyphs.filled.image`**.
  This is the editor's legend thumbnail for `#` and is already authored
  for every shipped tileset. Means v10 needs no data migration. Locked.
- **Animation sheets in entity slots** — **accept the squashed strip for
  v10**; explicitly call it out as a known cosmetic limit. Sprite-frame
  cropping is v11. Locked.
- **Decor for non-Dirt** — **out of scope**. Decor (grass/moon/stars/
  drips) stays atlas-gated and Dirt-only. v11 lifts decor data into the
  lookup. Locked.
- **Test gate for the fix** — extend the existing Playwright harness
  with a *mutual-distinctness* hash assertion across all manifest
  tilesets (today: red; v10: green). Cheaper and less brittle than
  per-tileset snapshot baselines. Locked.

## 10. Acceptance criteria

- Switching to PlayWithYourPeas, Pixel Adventure 1, Treasure Hunters, or
  2D Circle Graphic **changes the preview canvas** — it shows that
  tileset's own block / player / hazard / pickup / exit art (modulo the
  v11 cosmetic limit on animation sheets, §6).
- Dirt's preview is **visually identical** to v9.
- `npm test` green; the Playwright test goes from one passing diagnostic
  to two passing tests (capture + distinctness assertion).
- `npm run build` clean; `npm run build:pages` clean; live deploy works.
- No data file under `public/data/tilesets/` changes (declared in §7
  module-map).

## 11. Non-goals + v11+ candidates

The user's broader analysis maps cleanly into v11+:

- **Per-category authorable variants** — multiple glyph chars sharing a
  role (`o`/`O`/`&` all pickups), grouped in the legend.
- **State-changing exit** — `glyphs.exit.imageActive` swapped by the
  playtest's Goal entity once all pickups are collected.
- **Decoration layer** — new `role: decoration`; multi-glyph; validator
  + playtest adapter ignore; renderer draws.
- **Sprite-frame cropping** — `glyphs.<role>.frames: N` (sheet width =
  N × TILE), `frame: 0` index; entityFor returns a renderer that crops
  to one frame.
- **Procedural-decor data** — move Dirt's hardcoded grass / drips / moon
  / stars rules into `lookup.decor` so other tilesets can declare their
  own.
- **Auto-picked cosmetic variants** — same glyph char, hash-picked from
  N images (e.g. four dirt-centre variants).
- **Convention-based autotile discovery** — optional; useful only if a
  single naming convention is adopted across all in-house packs.
