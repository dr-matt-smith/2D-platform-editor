# 2D Level Designer — Version 18 Design Document

Status: Proposed · Date: 2026-05-21 · Builds on:
[version17_design.md](version17_design.md) (graphical-only editing
surface) · Implementation: *to follow once this scope is approved*.

## 1. Purpose

A coherent bundle of editor / game-design UX upgrades, each
discussed in the user's wishlist:

1. **Cleaner legend** — drop the glyph-char prefixes (`#`, `P`, `.`,
   `E`, `^`, `o`); rename "Happy point" → "Pickup"; support multiple
   variants per category (multi-blocks, multi-traps).
2. **Background images** — a tileset can declare full-rectangle
   background art (stretched to fit) and **decoration images**
   (e.g. clouds, plates). The legend gains a Background dropdown
   and a Decorations group.
3. **Decoration z-order** — the new `foreground` role lets a
   decoration glyph sit *in front of* the interactable tile in its
   cell (vs. the existing `background` decoration sense). Layered
   z-order generalises in v19+ (§13).
4. **Play in place** — pressing Play makes the **current canvas**
   the playtest surface (no modal popup). Esc returns to edit
   mode.
5. **Play Settings popup** — a new toolbar button opens a small
   dialog. v18 ships **one** setting: the pickup requirement (no
   minimum / N minimum / all required) used by the playtest's
   win condition.
6. **Mockup reference** — the PWYP tileset ships
   `tiles/Mockup.jpg` as a vision for how background+decoration
   together can transform a level's look.

The level format / playtest physics / tileset accessors are all
preserved; v18 is editor-UI + tileset schema additions + a
playtest mode refactor.

## 2. Current state (per topic)

- **Legend** today (v8+) renders each entry as `<thumb> <b>char</b>
  name` (e.g. `[thumb] # Filled`). For PWYP, the entries read
  `# Block`, `P Pea`, `E Goal flag`, `^ Trap alert`, `o Happy
  point`. Authors paint by clicking the entry — the char is the
  source of truth internally, not a label the user needs to see.
- **Background**: the editor preview clears with `SKY` (#1b2a3a)
  and (for Dirt only, atlas-backed) tiles `T.sky` per cell. No
  whole-rectangle background image affordance.
- **Decoration glyphs** (v11/v17): a glyph with `role: "decoration"`
  is paintable, inert in playtest, drawn under entities in Pass 4a.
  No further z-ordering.
- **Play**: pressing the Play button (or Ctrl+Cmd+Enter) opens a
  modal `.playtest` overlay that runs the playtest on a fresh
  canvas. The editor's `#preview` canvas sits behind it, untouched.
- **Pickup win condition** is hardcoded: **all** pickups must be
  collected before touching `E` ends the level.

## 3. Schema additions

### 3.1  Multi-variant legend grouping (no schema change required)

v11 already allows multiple `glyphs` entries to share a role. v18
makes the legend **visibly group** them. Example: a tileset with
two `terrain` glyphs (`#` brick, `B` stone) renders the legend as

```
Terrain
  [brick] Brick   [stone] Stone

Player
  [pea] Pea

Pickup
  [icon] Pickup

…
```

Group headers come from the role taxonomy; per-glyph names come
from the lookup. Char prefixes are gone (the active glyph is shown
by border highlight as today).

### 3.2  `images` block — background + decoration art

A new top-level `images` section in `tile_lookup.json` declares
whole-rectangle background art and free-floating decoration art.
The user's draft used duplicate keys in the same object (JSON would
silently drop all but the last); v18 normalises to **an array of
entries keyed by stable IDs** — same idea, valid JSON:

```jsonc
"images": {
  "bg-blue-clouds": {
    "name": "Blue with clouds",
    "role": "background",
    "image": "tiles/Background.png"
  },
  "deco-plate": {
    "name": "Plate",
    "role": "decoration",
    "image": "tiles/Plate.png"
  },
  "deco-cloud-1": { "name": "Cloud 1", "role": "decoration", "image": "tiles/Cloud1.png" },
  "deco-cloud-2": { "name": "Cloud 2", "role": "decoration", "image": "tiles/Cloud2.png" },
  "deco-cloud-3": { "name": "Cloud 3", "role": "decoration", "image": "tiles/Cloud3.png" }
}
```

Each entry has a stable string ID (the object key), a human
`name` for the legend, a `role` (only **`background`** or
**`decoration`** in v18), and an `image` (tileset-relative path).

- **`role: "background"`** entries are whole-rectangle: the
  renderer paints the picked image stretched to fill the level
  area before everything else. Behaviour: `ctx.drawImage(img, 0,
  0, levelW, levelH)`. Aspect-ratio mismatch is accepted (matches
  the user's "stretch" intent); a future v19 could add `cover` /
  `contain` modes.
- **`role: "decoration"`** entries are **NOT placed** in v18
  (placement model is v19+, §13). They're declared so the legend
  can list them, and so a future version can read the same files
  without a schema change.

The active background image's ID lives in the buffer as a header
directive: `# background-image: <id>` (default: none → solid
`SKY` colour, identical to today). The Background dropdown
mutates this directive via a pure helper (mirrors the v8
`setTilesetDirective`).

### 3.3  `foreground` role for decoration glyphs

The user added a new entry to PWYP's `glyphs.decoration` with
`role: "foreground"`. v18 formalises this:

| Role | Where drawn in the renderer |
|---|---|
| `background` | (v11) Pass 4a, **under** entities — already implemented |
| `foreground` (v18 NEW) | a new Pass 4c, **over** entities |
| `decoration` (alias) | treated as `background` for back-compat — same as the v11/v17 reading |

In playtest, both `background` and `foreground` decorations remain
**inert** (no collision, no score, no win/lose effect) — they're
visual only. The player overlay's draw order interleaves:

```
… terrain → decorations[background] → entities → player → decorations[foreground]
```

So a "Flag Pole" decoration with `role: foreground` correctly
covers the cell's interactable tile (e.g. a pole rooted in a
ground block).

Existing tilesets using `role: "decoration"` (treated as
background) continue working unchanged.

### 3.4  `# pickup-required:` directive

The buffer gains an optional header directive recording the
playtest's pickup requirement, set by the Play Settings popup:

- absent (default) → ALL pickups required (today's behaviour).
- `# pickup-required: 0` → no minimum (touch the exit to win).
- `# pickup-required: N` (integer ≥ 1) → at least N collected
  before the exit becomes winnable.
- `# pickup-required: all` → explicit "all required" (same as
  absent, just legible).

The directive is per-level so different levels can ship different
rules. `parse()` reads it into `meta.pickupRequired`. The playtest
scene checks `score >= required` before accepting a goal overlap.

## 4. UX changes in detail

### 4.1  Legend cleanup

`renderLegend()` is rewritten:

- Read the legend (already char-keyed with `{name, role, image,
  color}`); also read `lookup.images` for image-only entries.
- Group entries by **role** in a fixed order:
  - `background` (images only — new Background dropdown row)
  - `terrain`
  - `player`
  - `exit`
  - `hazard`
  - `pickup`
  - `decoration` (glyphs with role `background` or `decoration`)
  - `foreground` (glyphs with role `foreground`)
- Within each group, render one button per variant:
  `[thumb] <name>`. **No char prefix.** The active glyph is shown
  by the existing border-highlight class.
- The Background row is a single **dropdown** (not paint buttons):
  picking an entry sets `# background-image:` in the buffer; the
  renderer paints it on the next reflow.

For the rename: PWYP's tile_lookup.json gets `name: "Pickup"`
instead of `"Happy point"`. (One-character data change in the v18
data milestone.)

### 4.2  Mockup as design reference

`public/data/tilesets/PlayWithYourPeas/tiles/Mockup.jpg` (an
801×599 illustration from Daniel Cook's "Play With Your Peas"
sketches; see PWYP `sources.txt` for licence + attribution)
is the target look-and-feel. v18 doesn't *render* the mockup
inside the editor — it's a design reference for what the
background + decoration composition aspires to. The transcript
should embed a short link to it for future contributors.

### 4.3  Play in place

The v9 modal overlay is retired for the common case. Pressing
Play (or Ctrl+Cmd+Enter) does:

1. Toggle the editor into **play mode** (a small state flag
   `editorMode = 'edit' | 'play'`).
2. Detach the rectangle-marquee overlay (`#overlay` pointer
   handlers), so painting doesn't fire during play.
3. Instantiate the vendored `Game` + `Input` + `AssetLoader` and
   mount a `PlaytestScene` on the **existing `#preview` canvas**.
4. Replace the toolbar with a Play-mode toolbar:
   `[Restart (R)] [Exit (Esc)] coins: X / Y  level: tutorial`
   — same affordances the modal had, on the same toolbar bar.
5. Esc (or the Exit button) sets `editorMode = 'edit'`: stops
   the game loop, disposes Input, removes the play-mode toolbar
   overrides, re-attaches the marquee overlay, repaints the
   editor preview.

The `PlaytestScene` and `buildViewGrid` from v14 are reused. The
v9 `.playtest` modal DOM + the launcher's modal-construction
code are removed; `launchPlaytest` becomes "attach playtest to
the editor's canvas" instead of "open a new canvas in a modal".

**Why this is more than a CSS change:** the v12-v14 work assumed
playtest had its own dedicated canvas. In v18, the canvas is
shared. We need: the editor's render loop pauses while play mode
is active; the play mode's render loop replaces it; on exit, the
editor's normal `run()` repaints. The `PlaytestScene`'s draw was
already delegating to the editor renderer (v14), so the pixel
path is unchanged; only the mounting/teardown changes.

### 4.4  Play Settings popup

A new toolbar button **`[Play Settings]`** opens a small modal
(the existing `openConfirm` shape can be reused/extended). v18
ships one setting:

```
Pickup requirement:
  ( ) No minimum — touching the exit wins regardless
  ( ) Minimum [_3_] pickups — collect at least N before the exit wins
  (•) All pickups required (default)

                              [ Cancel ]  [ Save ]
```

"Save" writes the chosen value into the buffer's `# pickup-
required:` directive via a pure helper (mirrors
`setTilesetDirective`). The Play Settings dialog is also where
future runtime options land — e.g. gravity preset, jump height,
spike behaviour. v18 keeps the dialog single-row; v19+ adds rows
as needed.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/level.js` | `parse` reads `# background-image: <id>` → `meta.backgroundImage`; reads `# pickup-required: …` → `meta.pickupRequired`. New `setBackgroundImageDirective` and `setPickupRequiredDirective` (mirrors v9 `setTilesetDirective`). `serialize` emits both when non-default. |
| `src/tileset.js` | parse `lookup.images` into a new `imagesByRole` map; preload `role:"background"` images at load time; expose `backgroundImage(id)` accessor returning the loaded image; `decorationFor(char, now)` learns to split foreground/background — actually we add a parallel `foregroundFor(char, now)` accessor (mirrors decorationFor). The legacy `decoration` role keeps pointing at the background-decoration accessor for back-compat. |
| `src/renderer.js` | new Pass 0a: if `meta.backgroundImage` + tileset has it, `drawImage(bg, 0, 0, w, h)` before SKY rect (or replacing it). New Pass 4c: foreground decorations drawn *after* entities + player. |
| `src/play/playtestGate.js` | reads `meta.pickupRequired` (default 'all') into the gate result so the scene knows what to enforce. |
| `src/play/playtestScene.js` | win check changes from `score === total` to a pure helper `meetsPickupRequirement(score, total, required)` that handles `'all'` / number / `0`. The player overlay also gets drawn AT the right z-order point (between entities and Pass 4c foreground). |
| `src/play/launcher.js` | rewritten: instead of building a modal overlay, attach `Game` to the existing `#preview` canvas and return controls. The Esc handler hooks the document; Restart calls `scene.restart()`. |
| `src/main.js` | new `editorMode` state machine (`edit` / `play`); toolbar's Play button toggles modes; new `[Play Settings]` button opens a dialog (extend `loaderDialog.js` or add `playSettingsDialog.js`); new Background dropdown in the legend; legend renderer rewritten per §4.1; `# pickup-required:` round-trip wiring; `# background-image:` round-trip wiring. |
| `src/style.css` | new `.playmode` body class (or container class) that hides the marquee overlay and shows the Restart/Exit toolbar overrides; legend group-header style; Background dropdown style alongside Tileset/Level. |
| `public/data/tilesets/PlayWithYourPeas/tile_lookup.json` | normalise the `images` block to the §3.2 array-keyed shape; rename `"Happy point"` → `"Pickup"`; the user's `decoration` glyph with `role: "foreground"` stays. |
| `tests/playtest-modal.spec.js` | deleted — the modal is gone; the playtest is the same canvas. The v14 playtest-tileset spec and v16 animation spec **need to be updated**: they reference `.playtest canvas` (the modal) and `'Escape'` (still works); the selector becomes `#preview` and the launch trigger is the same. |
| `src/play/playtestScene.test.js` | extended with the `meetsPickupRequirement` cases. |

## 6. Open questions — proposed defaults

- **`images` block shape** — user's draft used duplicate keys
  (invalid JSON object). **Proposed:** object keyed by stable IDs
  (§3.2 example). Alternative: an array. The object keeps lookups
  O(1) and feels natural for hand-authoring; recommend object.
- **Background image stretching** — `cover` / `contain` /
  `stretch`? **Proposed:** stretch (matches the user's wording);
  v19 candidate to allow opt-in `cover`/`contain` per image.
- **Where does the decoration-image placement model live?** — the
  user's wishlist mentions decoration images going behind/in
  front of level contents, but cell-based placement isn't enough
  for free-floating clouds. **Proposed v18 scope: declare
  `role:"decoration"` images in the schema BUT defer placement
  to v19** (free-positioned with x,y or anchored). v18 paints
  whichever single background-image is selected; decoration-image
  entries are visible in the legend Decorations group as labels
  only (clicking does nothing meaningful in v18 — v19 adds the
  placement mode).
  - **Alternative**: treat each decoration-image as a *single
    sticky cell* the author paints with (essentially turn them
    into auto-generated decoration glyphs). Simpler, less
    expressive than free positioning. Decide with the user.
- **Where to store the pickup-required setting** — buffer
  directive (per-level, sharable) vs `localStorage` (session-wide).
  **Proposed:** directive (per-level, parses cleanly, downloads
  with the level).
- **What happens to history on the directive change?** — like
  `setTilesetDirective`, the Play Settings "Save" goes through
  `applyEdit(text)` so it's a normal undo step.
- **Should `[Play Settings]` be next to Play, or in its own
  group?** — Adjacent to Play makes the relationship clear:
  `[Play] [Play Settings]`. Lock there.
- **Foreground decorations vs the player z-order in playtest** —
  proposed §3.3 model puts the player BELOW foreground
  decorations (so a Flag Pole hides the player behind it). The
  user said the player's layer is an open question; locking
  "player above background-decoration, below foreground-
  decoration" is a sensible default and the v19+ layers feature
  formalises it.

## 7. Acceptance criteria

- **Legend**: no glyph chars visible; entries grouped by role; the
  active glyph still highlighted on click; clicking still sets
  the active glyph; multi-variant tilesets (any future tileset
  with `frames > 1` per role, or multiple chars per role) show
  multiple buttons per group; PWYP's "Pickup" reads "Pickup".
- **Background dropdown**: appears in the legend's Background
  group whenever `images` declares ≥1 `role:"background"`
  entry. Picking one sets `# background-image: <id>` and
  repaints; "(none)" entry restores the solid `SKY` colour.
- **Decoration z-order**: a `role: "foreground"` decoration is
  drawn over the cell's interactable tile (visible "in front"),
  whereas `role: "background"` (and legacy `role:
  "decoration"`) decorations sit beneath.
- **Play in place**: pressing Play makes `#preview` the live
  playtest canvas; Esc returns to edit mode; no modal overlay
  appears. The Mask Dude animation, distinctness, and tileset-
  art-in-playtest behaviours from v14/v16 are preserved.
- **Play Settings dialog**: opens from a toolbar button; saves
  the picked option into `# pickup-required:`; the playtest's
  win check honours it.
- `npm test` green; `npm run test:e2e` green (the v14 / v16 e2e
  specs are updated for the no-modal world).

## 8. Non-impact (explicit)

- Level format glyphs (`#`, `P`, `.`, `E`, `^`, `o`) and the v11
  multi-glyph rules — unchanged.
- The vendored `simple-platformer-1` engine and its §7 byte-
  identical invariant — unchanged.
- The v17 single-line message bar / hidden text pane / tileset
  dropdown — unchanged.
- The v16 animator path — unchanged (background images are
  static; foreground/background decoration glyphs still use the
  same animator if they declare `frames`).
- The v9 `# tileset:` / v8 size-and-name directives — unchanged.

## 9. Mockup.jpg as the visible target

The user dropped
`public/data/tilesets/PlayWithYourPeas/tiles/Mockup.jpg` into the
PWYP tileset as a vision sketch — clouds drifting over a sky-blue
background, a serving plate beneath the Peas, plus the gameplay
sprites. The credit (LostGarden / Daniel Cook, CC) is in
`public/data/tilesets/PlayWithYourPeas/sources.txt`.

After v18 ships:

- The Background dropdown lets an author pick the sky+clouds
  background → the canvas paints it stretched.
- Decoration glyph entries (with `role: "background"` /
  `"foreground"`) can be painted into specific cells.
- Decoration image entries are **declared** in the lookup but
  their placement is **v19+** (§13). The Mockup's "free-floating
  clouds" effect remains a v19 acceptance target — v18 lays the
  schema groundwork.

## 10. Acceptance criteria for the user's PWYP draft

The user's `tile_lookup.json` edits land cleanly after a small
normalisation:

- Rename `"Happy point"` → `"Pickup"`.
- Restructure the `images` object so each entry has a unique
  key (`bg-blue-clouds`, `deco-plate`, `deco-cloud-1`,
  `deco-cloud-2`, `deco-cloud-3`) and a `role` field
  (`background` for the sky image; `decoration` for plate +
  clouds).
- Keep the decoration glyph entry with `role: "foreground"`
  (Flag Pole) as authored.

After these normalisations, PWYP becomes the canonical example of
v18's schema additions for the README / transcript to point at.

## 11. Open scope question — what to defer to v19

v18 already carries a lot. The biggest deferral candidate is the
**decoration-image placement model**:

- Cell-based "paint a Plate decoration here" — quick to ship; less
  expressive than the Mockup suggests.
- Free-positioned `[{imageId, x, y}, …]` — more flexible; requires a
  new placement-list section in the level file and a drag-place
  authoring mode. Real scope.

**Recommendation**: v18 ships cell-based decoration-image placement
("place this decoration image AT a cell, like a decoration glyph")
as an interim — the cloud goes in a single sky cell stretched to
fit, not freely floating. v19 adds the real free-positioning model
with a placement-list. The cell-based form is then an automatic
back-compat path.

Open to the user's call: cell-based now, or defer decoration-image
placement entirely to v19?

## 12. Acceptance criteria (re-stated for the bigger items)

- **Play in place**: from a fresh editor session, press Play →
  the existing `#preview` canvas becomes the game; the toolbar
  shows Restart/Exit/HUD; Esc returns and the editor preview
  repaints from the same buffer.
- **Play Settings → pickup requirement**: open the dialog, pick
  "Minimum 2", save, press Play; collect 2 pickups, touch the
  exit, the playtest wins (today's `all` rule would not). Open
  the dialog again, pick "No minimum", save, press Play, touch
  the exit with 0 collected, the playtest wins.
- **Background image**: pick "Blue with clouds" from the legend
  Background dropdown → the canvas paints the sky behind the
  level. Pick "(none)" → solid SKY colour as before.
- **Foreground decoration**: paint a Flag Pole on a cell that
  already has a ground tile underneath → the pole renders over
  the ground. (Same cell holds two glyphs? No — see §13 layers
  open question.)

## 13. Non-goals + v19+ candidates

- **Free-positioned decoration images** (the Mockup's drifting
  clouds). v18 declares the schema; v19 adds the placement.
- **Layered z-order with named layers** — the user raised this
  explicitly. v19 candidate. The pre-named layers we'd want:

  ```
  background-image
  decoration-background-images
  decoration-background-glyphs
  terrain / entities / player
  decoration-foreground-glyphs
  decoration-foreground-images
  hud / banner
  ```

  Plus author-named layers (`layer: "fog"`, `layer: "back-trees"`)
  for further customisation. The player's "ground" layer sits
  between background-glyph and foreground-glyph by default.
- **Multi-glyph cells** — currently each cell holds one glyph. A
  "ground + flag pole in the same cell" is achieved by the v18
  foreground role (decoration drawn on top of the cell's primary
  glyph). A real multi-layer cell (where the cell holds an
  ordered list of glyphs) is v19+.
- **`cover` / `contain` modes for background images** — stretch
  only in v18.
- **`Play Settings` row growth** — gravity, jump preset, spike
  one-shot mode, time limit, lives, etc.: each is a v19+ row.
- **Background image authored per-level** — v18 picks per buffer
  via the dropdown which writes the directive. Per-tileset
  default (so a tileset declares its preferred background) is a
  v19 polish.
- **Animated background images** — out of scope.
- **Removing the dead-end `caretLineCol` / `updateCursor`
  helpers** — v17's deferred cleanup still pending.
- **Keyboard nudge on the (hidden) splitters** — moot until
  splitters return.
