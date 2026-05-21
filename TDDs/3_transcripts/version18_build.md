# Transcript — Version 18: Backgrounds, Foreground Layer, Play-in-Place, Play Settings

A narrative record of the v18 phase: a six-item wishlist that
between them remake what the legend looks like, how the canvas
paints, how a playtest starts, and how an author tunes a level's
win condition.

## The brief

User wrote it across the v17 wrap-up note and a fresh
`__temp/wish_list.md`. Ten bullets in total, but four were already
the v17 brief (which had landed) and one was a future-features
marker; the v18-actionable scope reduced to:

> (1) clean up the legend — drop the char prefixes (`#`, `P`, `.`,
>     `E`, `^`, `o`); rename PWYP's "Happy point" → "Pickup"; allow
>     multi-variant blocks/traps; group by role.
> (5) add a **Play Settings** toolbar button opening a popup with
>     a pickup-requirement choice (no minimum / minimum N /
>     all required) used by the playtest's win condition.
> (6) make **Play** mode happen **in place** — pressing Play turns
>     the existing editor canvas into the live game; no modal.
> (7) tilesets can declare a **background image** (stretched to
>     fit) and **decoration images** (clouds, plates) in a new
>     `images` block. Editor gets a Background dropdown.
> (8) a new **foreground** role for decoration glyphs (e.g. PWYP's
>     Flag Pole) so they paint **over** the cell's interactable
>     tile.
> (9) ship `tiles/Mockup.jpg` as the visible target the new
>     schema aspires to.

The v19+ future-features marker: layered z-order with named or
numbered layers, free-positioned decoration images, more Play
Settings rows. Those stay out of v18 (the schema for image-
decorations is laid down so v19 can build on it without a format
break).

## The shape of the work

Six small commits, one milestone each, in dependency order:

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `2c3c697` | `level.js`: `V11_ROLES` adds `"foreground"`; `parse`/`serialize` round-trip `# background-image:` + `# pickup-required:`; pure `setBackgroundImageDirective` + `setPickupRequiredDirective`; **PWYP tile_lookup.json normalised** (the user's draft had duplicate keys + a `}` typo + Cloud3-points-at-Cloud2.png — all fixed); 14 new unit cases |
| 2 | `930d229` | `tileset.js` parses `lookup.images` into `backgroundImages` / `decorationImages` maps + new `foregroundChars` set; new `backgroundImage(id)` / `decorationImage(id)` / `foregroundFor(char, now)` accessors. `renderer.js` gains **Pass 0a** (background image stretched, before SKY) and **Pass 4c** (foreground decorations, after entities). Renderer test extended with new cases. |
| 3 | `09186d0` | `main.js` `renderLegend()` rewritten: group by role with `.legend-group` headers, **no char prefix**, "Pickup" reads "Pickup". New **Background dropdown** row that writes `# background-image:` via `setBackgroundImageDirective` + `applyEdit`. CSS for `.legend-group`, `.bg-pick`, `.glyph.inert`. |
| 4 | `740a52f` | `launcher.js` rewritten — **no `.playtest` modal**. `PlaytestScene` mounts on `#preview`. `main.js` gets `editorMode = 'edit' | 'play'` + body `.playmode` class; toolbar swaps Play/Settings/New/Download for Restart/Exit via `.edit-only` / `.play-only`. Playwright specs updated: `#preview` selector + `body.classList.contains('playmode')` waits. |
| 5 | `6a29d02` | new `src/playSettings.js` — pure `meetsPickupRequirement(score, total, required)` (8 unit cases). `openPlaySettings()` modal in `loaderDialog.js`. New `[Play Settings]` toolbar button. `playtestScene.js` win check + HUD cue use the helper, with `this.requiredPickups = parsed.meta.pickupRequired ?? 'all'`. |
| 6 | _this commit_ | v18 transcript; design + impl Delivered |

Outcome: 170 → 178 unit tests (+8 playSettings cases on top of
M1's 14 schema cases that absorbed into the existing
`level.test.js` count). Playwright 4/4 still green throughout
(the playtest-tileset + playtest-animation specs were updated in
M4 for the no-modal world; tileset-screenshots + the distinctness
check unchanged). Both builds clean across all five milestones.

## The PWYP normalisation

The user's `tile_lookup.json` draft had real problems beneath
the surface — the manifest generator was silently dropping it.
M1's data fix:

- Extra closing `}` between two top-level keys → JSON parse fail
  before anything else.
- The `images` block: a typo'd section name `"backgounds"`
  (would-be schema-incoming silently ignored), three entries all
  keyed `"decoration-image"` (the JSON spec says the second and
  third overwrite the first — the user's intent of "five distinct
  images" got reduced to one), and `Cloud3` pointed at
  `Cloud2.png`. The cures: a single `images` object with
  stable string IDs (`bg-blue-clouds`, `deco-plate`,
  `deco-cloud-1/2/3`), each with `name` + `role` (background or
  decoration) + `image`; Cloud3 pointing at `Cloud3.png`.
- "Happy point" → "Pickup" per the design §1 rename.
- Kept the user's `decoration` glyph entry with `role: "foreground"`
  unchanged — the schema's new acknowledged role, just waiting for
  M2's renderer pass to consume it.

The normalisation is purely a `tile_lookup.json` rewrite; no code
in the editor needed to be defensive about the user's draft (the
draft never parsed; the editor never saw PWYP as a usable tileset
before this commit).

## The legend rewrite (M3 was the user-facing one)

M3 was the most visible single commit of the whole version. The
v8-era legend rendered each entry as `<thumb> <b>char</b> name`
(e.g. `[brick] # Block`). M3 rewrote `renderLegend()` to:

- Group entries by role in a fixed order: terrain, player, exit,
  hazard, pickup, decorations.
- Insert a `<div class="legend-group">Heading</div>` per group.
- Render each glyph as `[thumb] name` only — no char prefix.
- Add a Background-image dropdown row at the top when the
  tileset's `images` block has ≥1 `role: "background"` entry.
  Picking an option writes `# background-image: <id>` via
  `setBackgroundImageDirective` + `applyEdit` (a real undo step);
  picking "(none)" deletes the directive.
- Lump `role: "decoration"` images (PWYP's plate + clouds) into
  the Decorations group as **inert** entries with a dashed border
  and dimmed colour — visible but not clickable, since v18 has no
  placement model for them yet.

The active glyph highlight is still the border on the selected
button; nothing in the source-of-truth pipeline (char-keyed
`legend`, `activeGlyph` state) changed.

### The TDZ slip in M3

The first M3 commit attempt died across all four Playwright
tests with a black canvas. A `probe.spec.js` capturing
`pageerror` traced it to a **ReferenceError: Cannot access
'tileset' before initialization** — `renderLegend()` (called from
the initial `reflow()`) read `tileset?.lookup`, but the
`let tileset = null;` declaration sat further down the module
than the call. The fix: move `let tileset = null; let
activeTilesetId = null; let tilesetWarn = null;` up next to the
`legend / legendBase / activeGlyph` declarations. One-liner;
probe.spec.js deleted after diagnosis. No code change to
`renderLegend()` itself.

## The play-in-place refactor (M4 was the structural one)

M4 was the only structural change in v18 — the playtest no
longer opens a modal canvas.

The pre-v18 model (v9–v17) had `launcher.js` construct a
`<div class="playtest">` overlay containing its own
`<canvas>`, mount `Game` + `Input` + `PlaytestScene` on that,
and the editor's `#preview` canvas sat untouched behind. Exit
detached the overlay.

The v18 model: there is no second canvas. `launcher.js` takes
`#preview` as a parameter, sizes it to the world dimensions,
attaches the same `Game` + `Input` + `PlaytestScene`. The
editor's `run()` per-frame `editorDraw` would otherwise fight
the playtest scene's `requestAnimationFrame` loop for the
canvas, so `main.js` gates `run()` on
`editorMode === 'edit'` and short-circuits during play.

The visible coordination is a `body.playmode` class — CSS toggles
the `.edit-only` toolbar buttons (Play, Play Settings, New,
Download, etc.) off and the `.play-only` buttons (Restart, Exit)
on. The marquee overlay (`#overlay`) gets `pointer-events: none`
so painting doesn't fire mid-game. Esc on `window` (capture-phase)
calls `exitPlaytest()` which reverses everything and triggers
one `run()` to repaint the editor preview from the unchanged
buffer.

The Playwright spec updates: the v14 + v16 specs both selected
`.playtest canvas` and waited for the modal `state: 'visible'` /
`state: 'detached'`. M4 swapped them to `#preview` +
`waitForFunction(() => document.body.classList.contains
('playmode'))` / `!contains('playmode')`. The scene's draw
logic itself is unchanged from v14/v16 — same `buildViewGrid`,
same `editorDraw` delegation, same sprite overlay — so the
playtest-tileset and animation tests both passed against the
new mount point without further change.

The v9 §7 byte-identical-to-upstream invariant is preserved.
`launcher.js` and `playtestScene.js` are v9-original glue, not
vendored upstream files; the `core/` + `entities/` vendored
files were not touched in v18 at all.

## The Play Settings popup (M5 was the directive one)

M5 is the smallest behavioural commit by line count, but
introduces the first per-level header directive that *changes
the game's win rules* rather than the rendering.

The pure helper:

```js
export function meetsPickupRequirement(score, total, required = 'all') {
  if (required === 'all') return score >= total;
  if (typeof required !== 'number' || !Number.isFinite(required))
    return score >= total;     // defensive: NaN/Infinity → 'all'
  if (required <= 0) return true;
  const effective = Math.min(required, total);
  return score >= effective;   // clamped: can't require more than exist
}
```

The win-rule transition: `playtestScene.update()`'s goal-overlap
check switched from `if (this.score === this.total)` to
`if (meetsPickupRequirement(this.score, this.total,
this.requiredPickups))`. The HUD's "find the exit" hint uses the
same predicate, so a level with `# pickup-required: 0` shows the
"find the exit" cue from frame 0.

The modal `openPlaySettings({ pickupRequired, total, onSave,
onCancel })` reuses the `openConfirm` shape — modal-backdrop,
Esc cancels, backdrop click cancels, three radio rows (All /
At-least-N with a number input / No minimum). Selecting the
number input auto-selects the "At least N" radio for keyboard-
first input. The dialog footer shows the level's current pickup
count as context (`This level has 7 pickups.`).

`main.js` adds `<button id="playSettingsBtn" class="edit-only">
Play Settings</button>` next to Play. Save writes the directive
via `setPickupRequiredDirective` + `applyEdit` so it's a normal
undo step. Open the dialog, set "No minimum", save → press Play
→ touch the exit without collecting any pickup → YOU WIN.

## What stayed out (v19+ candidates carried forward)

Mostly the placement model for decoration images. The
`images` block declares them (PWYP's plate + clouds are in there
now), the tileset accessors load them (`tileset.decorationImage
(id)` returns the loaded `Image`), the legend lists them — but
v18 doesn't paint them anywhere on the canvas. A v19 free-
positioning model (`[{ imageId, x, y }, …]` as a placement-list
section in the level file plus a drag-place authoring mode) is
the obvious next step; the Mockup.jpg suggests drifting clouds
that need real x,y not cell-anchoring.

The full layered z-order with named or numbered layers — the
user's future-features bullet — is also deferred. v18's
hardcoded order (Pass 0a / 2 / 3 / 4a / 4b / 4c) is the seed.
Named layers (`layer: "fog"`, `layer: "back-trees"`) and an
ordered list of glyphs per cell are real scope.

Other carried-forward candidates:

- **`cover` / `contain` modes for background images** — v18
  stretches.
- **Per-tileset default background** — a lookup declaring its
  preferred `# background-image:` so the author doesn't have
  to pick.
- **Animated backgrounds** — `frames` on `images.<id>`.
- **More Play Settings rows** — gravity, jump preset, time
  limit, lives, spike one-shot mode. Each is a small follow-up.
- **Cleanup** of v17's dead-end `caretLineCol` / `updateCursor` /
  `lineColToCaret` helpers — still pending.
- **Per-cell animation phase offset** (v16 §8) — long-standing.
- **Pause-aware animation** — long-standing.
- **Multi-row tile atlases** — long-standing.
- **State-changing exit** (`imageActive`) — long-standing.

## The standing gap

Unchanged from v13/v14/v15/v16/v17 — no automated DOM-mutation
test of the broader interactive surface beyond Playwright. v18
grew the unit suite from 170 to 178 tests (+8 playSettings
cases on top of M1's schema-directive cases absorbed into the
existing `level.test.js` count). The four Playwright e2e specs
all stayed green; the playtest-tileset + animation specs were
adjusted in M4 to the no-modal selectors but the assertions
themselves didn't change.

The honest scope-deferral: v18 declared the decoration-image
schema and loaded the images — but there's no Mockup.jpg-like
"clouds drifting" rendered in the editor yet. That's a real
v19 acceptance target the schema groundwork in v18 is sized
exactly for.
