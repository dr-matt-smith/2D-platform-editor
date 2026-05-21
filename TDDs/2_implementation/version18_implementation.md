# Version 18 — Implementation Plan

Status: **Delivered (M1–M6)** · Date: 2026-05-21 · Design:
[../1_design/version18_design.md](../1_design/version18_design.md) ·
Transcript: [../3_transcripts/version18_build.md](../3_transcripts/version18_build.md)

Delivered, one path-scoped commit per milestone (the user's
in-flight `fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out throughout):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `2c3c697` | `level.js`: `V11_ROLES` adds `"foreground"`; `parse`/`serialize` round-trip `# background-image:` + `# pickup-required:`; `setBackgroundImageDirective` + `setPickupRequiredDirective`; PWYP `tile_lookup.json` normalised (duplicate keys + Cloud3 path + "Happy point" → "Pickup"); 14 new schema cases |
| 2 | `930d229` | `tileset.js` parses `lookup.images`, exposes `backgroundImage(id)` / `decorationImage(id)` / `foregroundFor(char, now)`; `renderer.js` Pass 0a (background image stretched) + Pass 4c (foreground decorations); renderer tests extended |
| 3 | `09186d0` | `renderLegend()` groups by role with headers + no char prefix; Background dropdown writes `# background-image:` via setter + `applyEdit`; decoration-image entries listed inert; CSS for `.legend-group` / `.bg-pick` / `.glyph.inert` |
| 4 | `740a52f` | `launcher.js` rewritten — no `.playtest` modal; `PlaytestScene` mounts on `#preview`. `editorMode = 'edit'\|'play'` + `body.playmode` class; `.edit-only` / `.play-only` toolbar swap; Playwright specs updated |
| 5 | `6a29d02` | `playSettings.js` pure helper `meetsPickupRequirement` (8 cases); `openPlaySettings()` modal; `[Play Settings]` toolbar button writes `# pickup-required:`; `playtestScene.js` win check + HUD cue use the helper |
| 6 | _this commit_ | v18 transcript; design + impl Delivered |

Outcome: 170 → 178 unit tests, Playwright 4/4 unchanged. Both
builds clean. All six UX changes from design §1 land on the live
deploy.

Six small path-scoped commits. The six UX upgrades in design §1 split
cleanly along schema → renderer → editor-UI → playtest-mode → settings
→ docs lines, so each milestone can land independently and roll back
on its own if needed.

## Process (same discipline as v8–v17)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  vendored files is preserved.** v18 only touches `playtestScene.js`
  (v9-original glue) and `launcher.js` (v9-original glue); the
  vendored `core/` + `entities/` byte-stay byte-identical.

## Constraints & approach

- **Back-compat is the gate** at every milestone:
  - Levels without `# background-image:` paint as today (solid SKY
    via the existing fillRect).
  - Levels without `# pickup-required:` win on "all pickups + touch
    exit" (today's rule).
  - Tilesets without an `images` block resolve through the existing
    accessor fallback chain; no error, no warning.
  - `role: "decoration"` in existing tilesets still draws under
    entities (the new "foreground" path is purely additive).
- **Pure helpers for new logic** (directive setters,
  `meetsPickupRequirement`) live as small exported functions so
  `node --test` covers the math without a DOM.
- **Play-in-place is the only structural refactor.** Keep it
  surgical: the v14 `buildViewGrid` + `editorDraw` pixel path is
  unchanged; only the canvas the scene mounts on changes (modal
  canvas → editor's `#preview`), and the editor's normal `run()`
  loop is paused while play-mode is active.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/level.js` | `parse` reads `meta.backgroundImage` + `meta.pickupRequired`; `serialize` round-trips both when non-default; `V11_ROLES` gains `"foreground"`; `setBackgroundImageDirective` + `setPickupRequiredDirective` pure helpers | M1 |
| `src/level.test.js` | extend tests for the new directive parse/serialize round-trips + the new role | M1 |
| `public/data/tilesets/PlayWithYourPeas/tile_lookup.json` | rename `"Happy point"` → `"Pickup"`; normalise the `images` block to the §3.2 unique-keys shape; keep the user's new `decoration` glyph with `role: "foreground"` | M1 |
| `src/tileset.js` | parse `lookup.images`; preload `role:"background"` images; expose `backgroundImage(id)` (returns Image or null); add a `foregroundFor(char, now)` accessor parallel to `decorationFor`; bucket decoration chars by sub-role (`background` vs `foreground`) | M2 |
| `src/tileset.test.js` | new cases for `images` parsing, `backgroundImage(id)` returning the loaded Image (and null for unknown IDs), `foregroundFor` returning a spec only for `role:"foreground"` glyphs and null for everything else | M2 |
| `src/renderer.js` | new **Pass 0a** before SKY fillRect: if `meta.backgroundImage` and `tileset.backgroundImage(id)` resolves, `drawImage(bg, 0, 0, w, h)` stretched. New **Pass 4c** after entities + player: iterate `foregroundFor(char, now)` per cell, draw over the entity layer | M2 |
| `src/renderer.test.js` | new cases assert: (a) background image draws at world dims before SKY when present, (b) `foregroundFor` cells get a drawImage call AFTER the entity pass, (c) Dirt/PWYP without background/foreground render byte-identically to v17 | M2 |
| `src/main.js` (legend) | `renderLegend()` rewritten: group entries by role per design §4.1; **drop the char prefix** from the button label (the active highlight already shows selection); show role headers; insert a Background dropdown row when `lookup.images` has ≥1 `role:"background"` entry; the dropdown change writes `# background-image:` via `setBackgroundImageDirective` and triggers `reflow()` | M3 |
| `src/style.css` | new `.legend-group` header style; new `.bg-pick` style for the legend's Background dropdown (mirror `.tileset-pick`); no-prefix glyph button polish | M3 |
| `src/play/launcher.js` | rewritten: no `.playtest` modal DOM, no separate canvas. Mounts `Game` + `Input` + `PlaytestScene` on the existing `#preview` canvas. Returns control hooks (`exit`, `restart`). Persistent `Esc` listener + Restart wired by `main.js` | M4 |
| `src/main.js` (mode toggle) | new `editorMode` state (`edit` / `play`); `tryPlaytest()` enters play mode; Esc + an Exit button leave it; toolbar swaps `[Play]` for `[Restart] [Exit]` while in play mode; the rectangle-marquee overlay is detached during play; the editor's `run()` is suppressed while in play mode (the playtest's per-frame `draw` paints the canvas) | M4 |
| `src/style.css` | new `body.playmode` class (or container class) that hides the marquee overlay's pointer events and shows the Restart/Exit buttons; legend remains visible (lets the player see which glyph icons mean what) | M4 |
| `tests/playtest-tileset.spec.js`, `tests/playtest-animation.spec.js` | updated for the no-modal model: replace `.playtest canvas` selector with `#preview`, replace `'await page.waitForSelector(.playtest)'` with `'await page.waitForFunction(() => document.body.classList.contains("playmode"))'` | M4 |
| `src/playSettings.js` (new) | small pure module: `parsePickupRequired(s)` (string → `'all' \| number \| 0`) and `meetsPickupRequirement(score, total, required)` (boolean) | M5 |
| `src/playSettings.test.js` (new) | unit tests for both helpers (all / 0 / N / clamped-to-total / invalid input) | M5 |
| `src/loaderDialog.js` | new `openPlaySettings({ pickupRequired, onSave, onCancel })` (mirrors `openConfirm`'s shape — modal + radio rows) | M5 |
| `src/main.js` (Play Settings) | new `[Play Settings]` toolbar button (next to Play); opens the dialog; Save writes `# pickup-required:` via `setPickupRequiredDirective` (with `applyEdit` for undo) | M5 |
| `src/play/playtestScene.js` | win check changes from `score === total` to `meetsPickupRequirement(score, total, required)`; `restart()` reads `meta.pickupRequired` from the parsed snapshot | M5 |
| `tests/playtest-tileset.spec.js` (extend) | one new sub-spec: paint a level with one pickup, set `# pickup-required: 0` via the dialog, launch playtest, touch the exit without collecting the pickup, assert win | M5 |
| `TDDs/3_transcripts/version18_build.md` (new) | narrative, v8–v17 style | M6 |

## Milestone 1 — Schema parsers + PWYP normalisation (pure, tested)

1. `src/level.js`:
   - `V11_ROLES` adds `"foreground"`.
   - `parse()` reads new directives:
     - `# background-image: <id>` → `meta.backgroundImage` (null if absent).
     - `# pickup-required: <0|N|all>` → `meta.pickupRequired` (`'all'` if absent; `Number` if numeric).
   - `serialize()` emits both when non-default (mirrors `# tileset:` / `# theme:` precedent).
   - `setBackgroundImageDirective(text, id /* | null */)` — pure;
     `setPickupRequiredDirective(text, value /* 'all' | 0 | N */)` — pure.
2. `src/level.test.js`: parse/serialize round-trip cases for both
   directives; absent / present / set-to-default round-trip.
3. `public/data/tilesets/PlayWithYourPeas/tile_lookup.json`:
   - Rename `"name": "Happy point"` → `"name": "Pickup"`.
   - Normalise the `images` block from the user's duplicate-key
     draft into the canonical object shape (design §3.2):
     `bg-blue-clouds` (background) + `deco-plate` /
     `deco-cloud-1` / `deco-cloud-2` / `deco-cloud-3` (decoration).
   - Keep the `decoration` glyph entry with `role: "foreground"`.
4. **No behaviour change** in the editor / renderer / playtest yet
   — the new fields and methods are declared but unconsumed.

Commit: `v18 m1: schema — background + pickup-required directives, foreground role, PWYP normalisation (tested)`.

## Milestone 2 — Tileset accessors + renderer (back-compat)

1. `src/tileset.js`:
   - Parse `lookup.images` into a map keyed by ID, with role and
     pre-loaded `Image`s for `role:"background"` entries (and
     `role:"decoration"` entries — used by v19 placement, but
     pre-loading them now is the cheap path).
   - Expose `backgroundImage(id)` → `HTMLImageElement | null`.
   - Add `foregroundFor(char, now)` → spec | null (mirrors
     `decorationFor`). Glyphs with `role:"foreground"` bucket here;
     `role:"decoration"` / legacy `role:"background"` stay in the
     existing `decorationFor` bucket. `entityFor` returns null for
     any decoration char (both flavours).
2. `src/tileset.test.js`: new cases per the module map above.
3. `src/renderer.js`:
   - **Pass 0a**: if `meta.backgroundImage` and the tileset's
     `backgroundImage(meta.backgroundImage)` returns an Image,
     `ctx.drawImage(bg, 0, 0, levelW, levelH)`. Then the existing
     SKY fillRect path can `return` early to avoid double-paint, OR
     we paint the BG image OVER the SKY fillRect (one extra
     drawImage but simpler). Pick the over-paint path.
   - **Pass 4c**: after the existing Pass 4b (entities + player
     fallback), iterate cells one more time; for each non-`.`,
     non-`#` cell, call `tileset.foregroundFor(char, now)`; if a
     spec comes back, `blitImage(ctx, spec, …)`.
4. `src/renderer.test.js`: assertions per module map.
5. **Visible** after this commit: a level with `# background-image:
   bg-blue-clouds` on PWYP shows the cloud sky behind the level. A
   `role:"foreground"` decoration paints over the entity in its
   cell. **The editor still has no UI to set these** — that lands in
   M3 / M5.

Commit: `v18 m2: renderer Pass 0a (background image) + Pass 4c (foreground decoration); tileset.backgroundImage + foregroundFor`.

## Milestone 3 — Legend rewrite + Background dropdown

1. `src/main.js` `renderLegend()` rewritten:
   - Iterate the active legend; group entries by role (background-
     image / terrain / player / exit / hazard / pickup / decoration
     / foreground), in that fixed order.
   - For each non-empty group, emit a group header
     `<div class="legend-group">Terrain</div>` followed by the
     buttons.
   - **Button text**: only `<thumb> <name>`. No `<b>char</b>`
     prefix. The active glyph's button still gets the `.active`
     class (visible highlight).
   - For the Background group: render a single `<select
     class="bg-pick">` populated from `lookup.images` entries
     where `role:"background"`. Prepend a `(none)` option. The
     active value is read from `meta.backgroundImage`; change
     writes the directive + `applyEdit` + `reflow`.
2. `src/style.css`:
   - `.legend-group` group-header style (small caps, dim colour,
     a touch of top margin).
   - `.bg-pick` mirrors `.tileset-pick` / `.level-pick`.
   - Remove the `<b>` styling rule for the old char prefix (if
     any specifics existed).
3. **Visible** after this commit: the legend looks per the design
   §4.1 mock; switching the Background dropdown paints the
   selected sky behind the level; switching to `(none)` restores
   the solid SKY fill.

Commit: `v18 m3: legend — drop char prefixes, group by role, Background dropdown`.

## Milestone 4 — Play in place (no modal)

1. `src/play/launcher.js` (rewritten):
   - Drop the modal-overlay construction. Take the existing
     `#preview` canvas, instantiate `Game` + `Input` +
     `AssetLoader`, attach the `PlaytestScene` (built with the
     active parsed buffer + legend + tileset).
   - Return a small controller: `{ ok, reasons, exit, restart }`.
2. `src/main.js`:
   - Add `editorMode = 'edit' | 'play'` (module-level let).
   - `tryPlaytest()` runs the gate as today; on green, enters
     play mode: detaches the marquee overlay (`#overlay` pointer
     listeners); sets `document.body.classList.add('playmode')`;
     swaps the toolbar buttons (hide Play / Play Settings / New /
     Download; show Restart / Exit).
   - Esc (capture-phase listener on `window`) leaves play mode:
     `game.stop()`, `input.dispose()`, restore the marquee
     overlay listeners, remove the `playmode` class, restore the
     toolbar, repaint the editor preview via `run()`.
3. `src/style.css`:
   - `body.playmode #overlay { pointer-events: none; }`
   - `body.playmode .edit-only { display: none; }` (apply
     `.edit-only` to Play / Settings / New / Download buttons in
     the template).
   - Restart / Exit buttons get a `.play-only` class hidden by
     default; `body.playmode .play-only { display: inline-flex; }`.
4. `tests/playtest-tileset.spec.js`, `tests/playtest-animation.spec.js`:
   - Replace `.playtest canvas` with `#preview`.
   - Replace the modal-detached wait with
     `await page.waitForFunction(() => document.body.classList.contains('playmode'))`.
   - Exit assertion: after Esc, `body.classList.contains('playmode')` is false.
5. **Visible** after this commit: pressing Play turns the existing
   editor canvas into the live game; Esc returns the editor.

Commit: `v18 m4: play in place — PlaytestScene mounts on #preview; no modal overlay`.

## Milestone 5 — Play Settings popup + pickup-required gate

1. `src/playSettings.js` (new, pure):
   - `meetsPickupRequirement(score, total, required)`:
     - `required === 'all'` → `score === total`.
     - `required === 0` → `true` (no minimum).
     - `required <= total` → `score >= required`.
     - `required > total` → `score === total` (clamped — can't
       require more than the level has).
2. `src/playSettings.test.js`: cases per the rules above.
3. `src/loaderDialog.js`:
   - `openPlaySettings({ pickupRequired, total, onSave, onCancel })`
     — a small modal with three radio rows (None / Minimum N /
     All) and a `<input type="number">` for N. "Save" calls
     `onSave(value)`. Reuses the existing modal CSS.
4. `src/main.js`:
   - New `[Play Settings]` toolbar button next to Play (gets
     `.edit-only` so play-in-place hides it).
   - Click handler: parse current buffer's `meta.pickupRequired`,
     open the dialog, on Save write
     `setPickupRequiredDirective(src.value, value)` via
     `applyEdit` (undo step) + `reflow`.
5. `src/play/playtestScene.js`:
   - `restart()` reads `this.parsed.meta.pickupRequired` (default
     `'all'`).
   - The win check inside `update()` becomes
     `if (meetsPickupRequirement(this.score, this.total,
     this.requiredPickups))` before testing goal overlap.
6. `tests/playtest-tileset.spec.js` extended:
   - Set `# pickup-required: 0` via the dialog (or by injecting
     into `src.value` directly in the test for determinism);
     launch playtest; touch the exit without collecting pickups;
     assert the canvas shows the YOU WIN banner.

Commit: `v18 m5: Play Settings popup + pickup-required win gate`.

## Milestone 6 — Docs + transcript + Delivered

1. `TDDs/3_transcripts/version18_build.md` (narrative): the
   architectural decisions (no-modal play, schema for background /
   foreground / images, pickup-required directive), the PWYP
   normalisation, the Mockup.jpg reference; honest scope-deferral
   note on decoration-image placement to v19.
2. Mark design + impl Delivered with the M1–M6 commit-hash table.

Commit: `v18 m6: docs + v18 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is pure + data-only.** No behaviour change in the running
  editor. The PWYP normalisation is the one thing that changes a
  shipped file; visible only as "Pickup" instead of "Happy point"
  in the legend (which M3 changes anyway).
- **M2 is the renderer wiring.** Risk: a Dirt subtle pixel diff if
  Pass 0a / 4c misfire. Mitigation: gate both passes on the new
  `meta.backgroundImage` / `foregroundFor` returning non-null;
  legacy renders take none of the new branches. The renderer
  test suite is the back-stop.
- **M3 has the most visible UI change** (legend layout). Risk: a
  user accustomed to the char-prefix layout gets disoriented. The
  thumbnails are still there; the tooltip on each button can
  surface the char for accessibility.
- **M4 is the only structural refactor** — playtest mounts on a
  different canvas than before. The v14/v16 e2e specs update is
  part of the same commit; if any of them go red, M4 is rolled
  back independently.
- **M5 changes the win condition** for any level whose author
  picks something other than the `all` default. Risk: a level
  that previously won by all-pickups still wins by all-pickups
  (the default is preserved); changing to `0` makes a level
  trivially winnable, which is the user's stated intent.
- **No deploy risk.** Bundle grows by a few hundred bytes (new
  helpers, new dialog, new render passes); Pages workflow
  unchanged.

## Deferred (design §13 → v19+)

- **Free-positioned decoration images** — the Mockup's drifting
  clouds. v18 declares them in the schema (so PWYP's
  `tile_lookup.json` is valid); the placement model + drag-place
  authoring mode is v19.
- **Named/numbered layer system** — the player's "ground" layer,
  the `background-image` / `decoration-bg` / `decoration-fg`
  layers as a real ordered stack with author-named additions. v19
  candidate; v18's hardcoded order (Pass 0a / 2 / 3 / 4a / 4b /
  4c) becomes the seed.
- **`cover` / `contain` modes for the background image** — v18
  stretches.
- **Per-tileset default background** — a tileset's lookup picks
  its preferred `background-image: <id>` so the author doesn't
  have to.
- **Animated backgrounds** — `frames` on `images.<id>`.
- **More Play Settings rows** — gravity, jump preset, time limit,
  lives, spike one-shot. Each is a small follow-up.
- **Cleanup** of the dead-end `caretLineCol` / `updateCursor` /
  `lineColToCaret` helpers (still pending from v17).
- **Per-cell animation phase offset** (v16 §8) — long-standing.
- **Pause-aware animation** — long-standing.
- **Multi-row tile atlases** — long-standing.
- **State-changing exit** (`imageActive`) — long-standing.
