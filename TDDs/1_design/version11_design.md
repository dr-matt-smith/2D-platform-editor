# 2D Level Designer — Version 11 Design Document

Status: **Delivered** · Date: 2026-05-20 · Builds on:
[version10_design.md](version10_design.md) §11 (v11+ candidates) ·
Built:
[../2_implementation/version11_implementation.md](../2_implementation/version11_implementation.md)
(M1–M5, all §12 acceptance met) ·
[../3_transcripts/version11_build.md](../3_transcripts/version11_build.md)

## 1. Purpose

v10 made the editor preview tileset-aware on the canvas. v11 makes the
**editable alphabet** tileset-aware: a single tileset can ship **several
pickups, several hazards, several decorations**, and the editor + play-
test understand them by their **role**, not their hardcoded glyph char.

Three concrete capabilities, picked together because they compose:

1. **Multi-glyph roles** — multiple glyph chars sharing a role (e.g. `o`
   apple, `O` cherry, `&` banana — all role `pickup`).
2. **Decoration category** — a new role for paintable, no-collision
   overlay tiles (trees, bushes, lanterns).
3. **Sprite-frame cropping** — fix the v10 cosmetic limit on animation
   sheets (Mask Dude / Apple): `frames: N` in the lookup → renderer
   shows one frame instead of a squashed strip.

The richer items (state-changing exit, procedural-decor data, auto-
picked cosmetic variants, convention-based autotile discovery) stay
deferred to v12+ (§13). v11 is one focused step.

## 2. Current state (what v11 changes)

- `tile_lookup.json` `glyphs` is **keyed by role name** (`empty/filled/
  player/exit/hazard/pickup`) — one entry per role.
- Validator, renderer, and playtest adapter **hardcode chars to roles**
  in code: `'#' → terrain`, `'P' → player`, `'^' → hazard`, `'o' →
  pickup`, `'E' → exit`. The role field exists on each glyph but is
  effectively cosmetic — nothing reads it.
- The renderer draws entity images **at full TILE size**, with no
  cropping (the v10 cosmetic limit).
- There is no decoration concept.

## 3. Roles — the v11 taxonomy

Each `glyphs` entry declares a **specific role**:

| role | gameplay | collision | how many chars allowed |
|---|---|---|---|
| `background` | none (the void) | none | 1 (`.`) |
| `terrain` | solid | full-tile | **1 (`#`)** in v11 — autotile depends on the mask. Multi-char terrain is v12. |
| `player` | spawn | — | **exactly 1** |
| `exit` | goal | overlap | ≥ 1 (multi-char allowed; any one wins the playtest) |
| `hazard` | lethal | overlap | ≥ 1 (multi-char allowed) |
| `pickup` | collectable | overlap | ≥ 0 (multi-char allowed; total counts together) |
| `decoration` | none (visual only) | none | ≥ 0 (multi-char allowed) |

The validator, adapter, and legend resolve **glyph char → role** by
walking the active tileset's `glyphs` entries (legend already does
this; v11 makes the adapter + validator do it too).

## 4. Schema additions (additive, back-compat)

### 4.1 Multiple `glyphs` entries — keyed by author choice

v11 keeps the existing `glyphs` shape but lets authors use **any keys**,
with `role` being the source of truth:

```jsonc
"glyphs": {
  "empty":  { "name": "Empty",   "char": ".", "role": "background", "image": null, "color": "#1b2a3a" },
  "filled": { "name": "Block",   "char": "#", "role": "terrain",    "image": "tiles/Block.png" },
  "player": { "name": "Player",  "char": "P", "role": "player",     "image": "tiles/Pea.png" },
  "exit":   { "name": "Flag",    "char": "E", "role": "exit",       "image": "tiles/Flag.png" },

  // Multi-glyph hazards: two chars, both role `hazard`.
  "spike":  { "name": "Spike",   "char": "^", "role": "hazard",     "image": "tiles/Spike.png" },
  "fire":   { "name": "Fire",    "char": "*", "role": "hazard",     "image": "tiles/Fire.png", "frames": 4 },

  // Multi-glyph pickups: three chars, all role `pickup`.
  "apple":   { "name": "Apple",  "char": "o", "role": "pickup", "image": "tiles/Apple.png",   "frames": 17 },
  "cherry":  { "name": "Cherry", "char": "O", "role": "pickup", "image": "tiles/Cherry.png" },
  "banana":  { "name": "Banana", "char": "&", "role": "pickup", "image": "tiles/Banana.png" },

  // Decorations (new — see §4.3).
  "tree":    { "name": "Tree",   "char": "T", "role": "decoration", "image": "tiles/Tree.png" },
  "bush":    { "name": "Bush",   "char": "b", "role": "decoration", "image": "tiles/Bush.png" }
}
```

Object **keys are author-facing identifiers only** (legend ordering,
maybe a future "variants" UI); behaviour is keyed by `role` + `char`.

### 4.2 `frames` and `frame` (sprite-sheet cropping)

Two optional fields per glyph:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `frames` | integer ≥ 1 | `1` | number of frames laid out **horizontally** in `image` (frame size = `image.width / frames` px wide × `image.height` px tall) |
| `frame` | integer ≥ 0 | `0` | which frame to display |

Scope-fence: v11 supports **horizontal strips only** (one row).
Multi-row tile atlases (Treasure Hunters' palm-terrain 17×5) are v12 —
they need a 2D index and the schema already shouldn't conflate the two.

### 4.3 Decoration role

Authoring: any glyph entry with `role: "decoration"`. Validator + play-
test adapter treat them as **inert** — no `entity` is built, no rule
fires. Renderer draws them in **Pass 4** alongside (but **before**)
entities, so a tree under the player reads as "the player is in front
of the tree".

## 5. Back-compat — what doesn't have to change

- Existing `tile_lookup.json` files (Dirt + the four user packs) **need
  no edits**. Their glyph entries declare `role: "entity"` or
  `role: "terrain"`; v11 reads those as legacy and infers the specific
  role from the **object key** (`glyphs.player.role` is treated as
  `player`, `glyphs.hazard` → `hazard`, etc.) — the same implicit
  mapping the editor uses today.
- Without `frames`, every existing glyph image renders exactly as in
  v10 (`frames` defaults to `1`).
- Validator's existing assertions (one `P`, at least one `E`, declared-
  size match, no undefined glyphs) are **kept**; they now resolve role
  via the legend (whose old/new schemas both produce the same `role`).

A future "v11+1" migration of Dirt's JSON to specific roles is
**optional** and cosmetic — not part of this version.

## 6. Validator changes

Today: hardcoded `'P'` count, `'E'` presence, glyph-set membership via
the legend's chars.

v11: role-driven:

- exactly one glyph **of role `player`** in the grid (today: one `P`).
- ≥ 1 glyph **of role `exit`** in the grid (today: warn on no `E`).
- every glyph char must appear in the legend (today: same, char-keyed).
- declared-size match (today: unchanged).

For tilesets using legacy `role: "entity"` the resolver maps the glyph
key (`player`/`exit`/`hazard`/`pickup`) to the specific v11 role. The
test-suite passes a v10-shape legend by default and asserts identical
behaviour to today (back-compat gate).

`validate(parsed, legend)` signature is **unchanged**; the body learns
the role resolver.

## 7. Playtest adapter changes

Today's `toWorld(parsed, tile)` is a hardcoded switch on the literal
chars `# / P / ^ / o / E`. v11 needs the legend to know which char
maps to which role. The signature becomes:

```js
toWorld(parsed, legend, tile = TILE)
```

Adapter walks each cell, looks up `legend[char].role` (via the role
resolver §6), and builds:

- `role === "terrain"` → `Platform`
- `role === "player"` → `Player` (still expected: exactly one)
- `role === "hazard"` → `Spike`
- `role === "pickup"` → `Coin`
- `role === "exit"` → `Goal`
- `role === "decoration"` → ignored (no entity; the editor renders it,
  the playtest doesn't collide with it)
- unknown / `background` → ignored

`playtestGate(parsed, legend)` already takes the legend (v9). Adapter
test-suite (`src/play/adapter.test.js`) grows new cases: multi-char
pickup count, multi-char hazard collision, decoration-glyph ignored.

## 8. Renderer changes — `frames`/`frame` cropping

The v10 accessors `terrainFor(mask)` and `entityFor(char)` return an
`HTMLImageElement | null`. v11 changes them to return a **draw spec**:

```js
{ image: HTMLImageElement, sx, sy, sw, sh } | null
```

For images without `frames`, `sx=0, sy=0, sw=image.width, sh=
image.height` — i.e. the v10 call signature, packaged. For images with
`frames: N`:

```
sw = image.width / N
sh = image.height
sx = frame * sw
sy = 0
```

The renderer's existing `blitImage(ctx, src, x, y, t)` helper becomes:

```js
ctx.drawImage(src.image, src.sx, src.sy, src.sw, src.sh, x, y, t, t);
```

Dirt's render stays byte-identical (no `frames` declared → `sw/sh =
natural size`; same `drawImage` args as v10).

**Animation choice:** v11 freezes on `frame` (default 0) — no
animation. Animating across frames at render time is reserved for v12
(needs a clock; the editor preview should still be deterministic).

## 9. Editor UX

- Legend now lists **every glyph entry** (no more one-per-role). Order:
  declaration order in `glyphs` (or `background → terrain → player →
  exit → hazard → pickup → decoration` if we choose to enforce — open
  question §11).
- A `# decoration: D, b, T` directive is **not** introduced — the legend
  shows decorations as ordinary buttons. Painting them is the existing
  rectangle/fill tool.
- No grouping UI for variants in v11. Visual grouping (e.g. "Pickups
  ▾" collapsible) is a v12 polish.

## 10. Architecture / impact

| File | Change |
|------|--------|
| `src/level.js` | `buildLegend` already produces char-keyed entries; **add `role`** to each (resolved via the legacy mapper). No grammar change. |
| `src/validate.js` | role-driven counts; legacy-role mapper |
| `src/play/adapter.js` | switch on `legend[char].role`; signature gains `legend` |
| `src/play/playtestGate.js` | thin wrapper change to find an exit by **role**, not literal `'E'` |
| `src/play/playtestScene.js` | calls `toWorld(parsed, legend)` instead of `(parsed)` |
| `src/play/launcher.js` | hands `legend` to the scene constructor |
| `src/tileset.js` | accessors return `{image, sx, sy, sw, sh}`; load `frames`/`frame` from glyphs |
| `src/renderer.js` | `blitImage` consumes a draw spec; **Pass 4a** decoration loop before entities |
| `src/main.js` | unchanged data flow (legend is already passed everywhere this needs it) |
| `tile_lookup.json` files | **unchanged** for v11 (back-compat). New packs can add `frames` and decoration glyphs. |
| `tests/tileset-screenshots.spec.js` | extended: a small fixture level with two pickup chars and a decoration glyph; assert distinctness still holds |

## 11. Open questions — to RESOLVE before implementation

- **Legend order** — declaration order in `glyphs` (cleanest; lets the
  author order their picker) or fixed role order (predictable; loses
  authorship)? **Recommendation: declaration order, with a fallback
  fixed role order for legacy single-key lookups.**
- **`role` discipline** — when both v11-style (`role: "pickup"`) and
  legacy-style (`role: "entity"`, key=`"pickup"`) coexist, which wins?
  **Recommendation: v11-style wins;** legacy is only consulted when
  `role` isn't a known v11 role string.
- **Decoration draw order** — under or over entities? **Recommendation:
  decorations under entities** (`Pass 4a` then `Pass 4b`). Player walks
  in front of trees.
- **Decoration overlap of `#`** — can a decoration sit on top of solid
  terrain (e.g. a wall-mounted lantern)? **Recommendation: yes** — the
  grid cell is the decoration char; terrain is the surrounding cells.
  If the author paints `T` directly on top of a `#` cell, the cell IS
  the decoration (not terrain) and the playtest treats it as inert.
  Same as today: each grid cell holds one glyph.
- **Frame range validation** — should the loader hard-error on
  `frames: 5` for an image whose width isn't divisible by 5? **No** —
  warn in the problems panel and round down (`Math.floor(width/N) ×
  N` becomes the usable strip; the right edge ignored).

## 12. Acceptance criteria

- An authored tileset with two pickup chars (`o`/`O`) renders both in
  the legend; both count toward the playtest win; `# tileset: …` swap
  preserves behaviour.
- A glyph with `role: "decoration"` is paintable, validates clean (no
  required count), is ignored by the playtest collision/score
  pipelines, and renders behind the player on the canvas.
- A glyph with `frames: 11` shows **one frame** in the legend AND on
  the preview canvas (not the squashed strip).
- Pixel Adventure 1, once its `tile_lookup.json` is updated with
  `frames` counts, no longer shows the Mask Dude / Apple strip — both
  read as a single character. Acceptance test: re-run the v10 Playwright
  distinctness check; manually compare Pixel Adventure 1's pane shot.
- Dirt and the other three v10 tilesets render **byte-identically** to
  v10 (no `frames`/decoration declared → unchanged).
- Existing test suite (currently 86 / 0) green; new `node --test` cases
  for the role resolver, the adapter's legend-driven mapping, and the
  loader's frame cropping. Target ≈ 100 unit tests after v11.
- Live deploy serves the same modules under the same URLs.

## 13. Non-goals + v12+ candidates

- **State-changing exit** (`imageActive`) — small, but unrelated to
  variety; pair it with another v12 polish.
- **Animated playback** of multi-frame sprites in the preview — v11
  freezes on frame 0; ticking the frame at a clock is v12.
- **Multi-row tile atlases** (Treasure Hunters palm-terrain): needs a
  `cols`/`rows` schema and a 2D index; v12+.
- **Procedural-decor data** — move Dirt's grass/moon/stars/drips rules
  into the lookup so other packs can author decor procedurally.
- **Multi-char terrain** — different solid materials with different
  appearances (wood/stone/metal) using more than one `#`-like glyph.
- **Auto-picked cosmetic variants** — same char, hash-picked from N
  images.
- **Convention-based autotile discovery** — naming convention →
  automatic 16-mask population.
- **Legend grouping UI** — collapsible role sections.
