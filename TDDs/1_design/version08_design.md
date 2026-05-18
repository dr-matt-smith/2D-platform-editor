# 2D Level Designer — Version 8 Design Document

Status: Delivered · Date: 2026-05-18 · Builds on:
[version07_design.md](version07_design.md) (v8 scope recorded there §13) ·
Built: [../2_implementation/version08_implementation.md](../2_implementation/version08_implementation.md)
(M1–M6, all §10 milestones delivered) ·
[../3_transcripts/version08_build.md](../3_transcripts/version08_build.md)

## 1. Purpose

Consume the v7 data layer to make the editor tileset-aware and visual, with
**no engine risk** (v7 already proved the mask renderer byte-identical):

- `level.js` `LEGEND` **derived** from the active tileset's `glyphs`;
  `validate.js` glyph set comes from it.
- **Wall → Filled**; empty / filled as the two basics (now data, not code).
- **Legend thumbnails** — each glyph shows its tile image + char + name.
- **`# tileset:`** additive header directive; the app reads it to pick the
  lookup.
- **New empty level** + a tileset chooser (uses the v7 tilesets manifest).

## 2. Current state (what v8 changes)

- `level.js` exports a **hardcoded** `LEGEND` (`.` empty, `#` *wall*, P, ^,
  o, E). `validate.js` does `g in LEGEND`; `main.js` builds the legend +
  glyph picker from `Object.entries(LEGEND)` as text buttons.
- `level.js` `parse` `meta` = `{name,theme,width,height,declared}` — **no
  `tileset`**. `serialize` emits name/theme/size.
- `tileset.js` `loadTileset()` is **no-arg, hardcoded** to
  `Dirt_Platformer_Tiles`; it already returns the parsed `lookup`
  (incl. `glyphs`, authored in v7 but unconsumed).
- `public/data/tilesets/manifest.json` exists (v7 M3), **no consumer**.

## 3. Derived legend

Add a builder to `level.js`:

- `buildLegend(lookup) → { <char>: { name, role, image, color } }` from
  `lookup.glyphs` (+ the `filled` entry, §4). `image` is a tileset-relative
  path or `null`; `color` is an optional swatch for image-less glyphs.
- `DEFAULT_LEGEND` — the Dirt-derived legend, kept as the offline/fallback
  and as `validate`'s default param so existing behaviour and tests are
  unchanged.
- `validate(parsed, legend = DEFAULT_LEGEND)` — the **only** signature
  change. Pure; `main.js` passes the active tileset's legend, tests pass
  none (→ Dirt, identical to today).

This keeps `validate.js` pure and synchronous; the async tileset load lives
in `main.js`, which derives the legend and hands it to `validate`.

## 4. `tile_lookup.json` `glyphs` completion (data, the "Wall→Filled")

v7 authored `glyphs` for empty/player/exit/hazard/pickup. v8 makes it the
single source of the editable alphabet:

```json
"glyphs": {
  "empty":  { "name": "Empty",        "char": ".", "role": "background", "image": null,  "color": "#1b2a3a" },
  "filled": { "name": "Filled",       "char": "#", "role": "terrain",    "image": "tiles/01_dirt_top.png" },
  "player": { "name": "Player spawn", "char": "P", "role": "entity",     "image": null,  "color": "#3498db" },
  "exit":   { "name": "Exit",         "char": "E", "role": "entity",     "image": null,  "color": "#2ecc71" },
  "hazard": { "name": "Hazard",       "char": "^", "role": "terrain",    "image": null,  "color": "#c0392b" },
  "pickup": { "name": "Pickup",       "char": "o", "role": "entity",     "image": null,  "color": "#f1c40f" }
}
```

- **Wall → Filled** is now just `glyphs.filled.name`. The grid char stays
  `#`; no level text, draft, or `localStorage` changes → **no migration**.
- `filled`'s thumbnail is **`tiles/01_dirt_top`** (a textured, recognisable
  ground tile), not the flat-dark `center` — the renderer never reads
  `glyphs.filled.image` (it uses the mask table), so this is purely the
  legend thumbnail and is chosen for legibility at small size.
- `color` mirrors the entity/sky palette so the legend can swatch image-less
  glyphs (decision **2a**). The single source is a new **`src/palette.js`**
  constant; `renderer.js` imports it instead of its inline `FALLBACK`/`SKY`
  (mechanical move, no logic change — the existing renderer suite proves
  it), and a unit test asserts `glyphs[*].color` equals `palette` for the
  shared glyphs. Unifying so the renderer reads colour *from the lookup*
  (retiring palette+test) is deferred to v9 (**2c**, §13).

## 5. `# tileset:` directive

- Additive header directive (like `theme`/`order`). `parse` reads it into
  `meta.tileset` (default `Dirt_Platformer_Tiles`). `serialize` emits
  `# tileset:` only when non-default (consistent with `theme`).
- Value = the tileset **directory id** (matches the tilesets-manifest `id`);
  the display name comes from the lookup.
- **Unknown / missing tileset** → fall back to the default and surface a
  non-blocking notice in the problems panel (a `warn`), never a crash.
- Existing levels (no directive) → default Dirt; render & validate exactly
  as v7.

## 6. Legend thumbnails

`main.js` `renderLegend` builds entries from the derived legend:

- `image` present → `<img>` of `/(data/tilesets/<id>/)<image>` scaled to a
  small fixed box (`image-rendering: pixelated`).
- `image: null` → a CSS swatch filled with `color`.
- Char + name beside it; the v4 click-to-set-active-glyph behaviour and the
  active highlight are preserved.

## 7. New empty level + tileset chooser

- `levels.js` gains `tilesets()` → fetches `/data/tilesets/manifest.json`.
- Loader dialog gets a **"New level"** action → pick tileset (manifest list)
  + size: **custom width × height number inputs** (with a couple of presets,
  e.g. 24×14 / 40×16, as quick-fill buttons) → `main.js` builds the buffer:
  `# name: untitled`, `# size: WxH`, `# tileset: <id>` (omitted if default),
  then `H` rows of the tileset's `empty` char. W/H clamped to sane bounds
  (e.g. 4–200).
- `currentId = null` (unsaved, like the offline sample). Validation will
  `error` "no player spawn" until the user adds one — expected and correct.

## 8. Architecture / impact

| File | Change |
|------|--------|
| `level.js` | `buildLegend(lookup)`, `DEFAULT_LEGEND`; `parse` → `meta.tileset`; `serialize` emits `# tileset:` |
| `validate.js` | `validate(parsed, legend = DEFAULT_LEGEND)` (only sig change) |
| `tileset.js` | `loadTileset(id = 'Dirt_Platformer_Tiles')` resolves that dir |
| `tile_lookup.json` | complete `glyphs` (filled + color); Wall→Filled |
| `main.js` | on load/switch: `loadTileset(meta.tileset)` → `buildLegend` → thumbnails → `validate(parsed, legend)` → draw; unknown-tileset notice |
| `loaderDialog.js`/`levels.js` | "New level" + tileset chooser |
| `renderer.js` | **unchanged** (engine is v7; zero risk) |

**Sequencing (the one real wiring change):** loading/switching a level is
now *tileset-dependent and async* — parse → `await loadTileset(meta.tileset)`
→ derive legend → render+validate. `main.js`'s `setBuffer`/`switchTo` must
order this correctly (today `loadTileset` runs once at startup).

## 9. Migration / back-compat

- Glyph chars unchanged; no level/draft/`localStorage` change → **no
  migration**.
- `validate`'s default param = Dirt legend ⇒ `validate.test.js` unchanged.
- Default/`# tileset: Dirt_Platformer_Tiles` levels are byte-identical to v7
  (engine untouched; legend is cosmetic).
- `tiles.json` retained; `tile_lookup.json` `glyphs` extended additively.

## 10. Milestones — all delivered ✓

(commit hashes in the
[implementation plan](../2_implementation/version08_implementation.md))

| # | ✓ | Deliverable |
|---|---|-------------|
| 1 | ✓ | `level.js`: `meta.tileset` parse/serialize; `buildLegend`+`DEFAULT_LEGEND` + tests |
| 2 | ✓ | `validate(parsed, legend?)` signature; tests (Dirt default unchanged) |
| 3 | ✓ | `tile_lookup.json` complete `glyphs` (filled, color, Wall→Filled); `loadTileset(id)` |
| 4 | ✓ | `main.js`: per-level tileset load → derived legend → thumbnails → validate; unknown-tileset notice |
| 5 | ✓ | "New level" + tileset chooser (loaderDialog/levels/main) |
| 6 | ✓ | Docs + v08 transcript; mark plan delivered |

## 11. Open questions — RESOLVED

- **`validate` signature** — optional `legend` param, default
  `DEFAULT_LEGEND`; pass the char-keyed legend object (future rules may want
  roles/names). Locked.
- **Image-less swatches** — **2a**: `color` field in `glyphs`, single-sourced
  via new `src/palette.js` (renderer imports it; mechanical, no logic
  change), guarded by a unit test that `glyphs` colours match `palette`.
  **2c** (renderer reads colour from the lookup) deferred to v9 (§13).
- **`filled` thumbnail** — `tiles/01_dirt_top` (textured, legible), not the
  flat `center`; it is legend-only data (§4).
- **Unknown `# tileset:`** — fall back to Dirt + non-blocking `warn`. Locked.
- **New-level size** — **custom W×H number inputs** plus preset quick-fills;
  clamped (§7). Locked.
- **Tileset switch cost** — cache by id, reload only when `meta.tileset`
  changes. Locked. (Cached lookup won't hot-reload mid-session; Vite's full
  reload covers it — not solving.)

## 12. Acceptance criteria

- A level with no `# tileset:` (or `Dirt_Platformer_Tiles`) renders &
  validates identically to v7; the legend shows tile thumbnails with
  **"Empty"** and **"Filled"** (no "Wall").
- An unknown `# tileset:` loads the default with a non-blocking problems
  notice; no crash.
- "New level" → choose tileset + size → an empty buffer with correct
  `# name/size/tileset` headers; validation reports the expected missing
  spawn.
- Existing levels, drafts, and `localStorage` are unaffected (no migration);
  `npm test` green, `npm run build` clean.

## 13. v9 candidates

**2c — unify entity colour**: `renderer.js` reads the image-less glyph
colour *from the loaded lookup* instead of its hardcoded `FALLBACK`, making
the lookup the single source (retires the v8 drift-guard test). Small but
touches the engine, hence v9.

Also: a real second tileset (proves the abstraction end-to-end, incl. decor
data); hazard/pickup variant picker UI; 47-blob (8-neighbour) for inner
corners; flood fill + line tool; reachability lint; play-test runtime; level
create/rename/delete
from the dialog.
