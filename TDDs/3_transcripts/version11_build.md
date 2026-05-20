# Transcript — Version 11: Authorable Variety

A narrative record of the v11 phase: making the *editable alphabet*
tileset-aware so a single pack can ship several pickups, several
hazards, and a decoration layer — and fixing the v10 cosmetic limit on
animation sheets. Decisions and rationale, in order.

## How v11 began

After v10 fixed the v8 decor-atlas bug ("non-Dirt tilesets all render
identically"), the user pushed back with a richer mental model than the
v8 schema had: categories (empty / filled / pickups / exit / hazards /
decorations), *multiple variants within a category*, a state-changing
exit, and the observation that some tilesets ship 16 edge tiles for
autotiling while others ship one block — *two ways of declaring tiles*.
The brief contained six or seven distinct ideas, mixed together.

The first move was to **separate the axes**: category vs. variant vs.
autotile-shape vs. state. They're independent: a category can have
multiple variants, a category can be authored with or without
autotiling, an exit can have one or two states. The schema doesn't have
to do all that work at once. We picked three composable additions for
v11 — the ones that touch the most authoring power for the least code —
and pushed the others (state-changing exit, procedural decor,
multi-frame animation, multi-row atlases, auto-picked variants,
convention-based autotile, legend grouping UI) to v12+.

## The locked scope

Three things, in dependency order:

1. **Multi-glyph roles** — multiple chars sharing a role
   (`o` apple + `O` cherry + `&` banana, all `pickup`). Adapter +
   validator become role-driven (legend-aware), not char-hardcoded.
2. **Decoration category** — new `decoration` role; multi-glyph;
   validator + playtest adapter treat as inert; renderer draws in its
   own pass beneath entities.
3. **Sprite-frame cropping** — optional `frames` / `frame` fields on a
   glyph; fixes the v10 cosmetic limit on animation sheets (Mask Dude
   and Apple in Pixel Adventure 1). Horizontal strips only; multi-row
   atlases deferred to v12.

Five open questions in the design were locked with my recommendations
*before* the impl plan was written: legacy key wins over explicit role
for legacy keys (back-compat with v10 lookups that used `role: "entity"`
generically); declarations order in the legend; decorations draw under
entities; one glyph per cell (a decoration cell isn't terrain); warn,
not error, on a non-divisor frame width.

## The pivotal observation

The four shipped non-Dirt `tile_lookup.json` files already declared
`glyphs[*].image` URLs for legend thumbnails, and v10 already taught
the renderer to read those for terrain cells. If the role resolution
piggybacked the same machinery, **the four shipped lookups would need
zero edits**. The only data file v11 touches is Pixel Adventure 1's,
adding two `frames` fields — and those numbers come directly from the
image dimensions (352÷32, 544÷32), not from design opinion.

That observation collapsed the implementation surface to four
milestones: role machinery in `level.js` (M1), wire the consumers (M2),
extend the renderer contract (M3), one data update (M4). One commit
each.

## Build

- **M1 — role resolver + role-driven validator (pure).** A new
  `V11_ROLES` taxonomy (`background / terrain / player / exit /
  hazard / pickup / decoration`); `ROLE_FROM_KEY` + `resolveRole(key,
  glyphEntry)` maps the legacy v10 schema (`role: "entity"` /
  `"terrain"` with the glyphs *key* as the real source of truth) onto
  v11 specifics, so the five shipped tile_lookup files keep working
  unchanged. `roleOf(legend, char)` is the single accessor everything
  downstream uses to map a level-text char to its v11 role.
  `validate.js`'s player-count and exit-presence checks become role-
  driven (was: literal `'P'`/`'E'`). Side-benefit: fixed a v10 mistype
  where `DEFAULT_LEGEND`'s `^` declared `role: 'terrain'` (no consumer
  read it, so behaviour-neutral; v11 reads it now, so it had to be
  right). **Tests 86 → 97 (+11).**

- **M2 — adapter + gate role-driven.** `toWorld(parsed, legend, tile)`
  — signature change: `legend` is now the second positional arg, role
  is the only switch. Multi-char categories (several pickups, several
  hazards) are supported transparently — adapter has no glyph
  knowledge of its own. `playtestGate.hasExit` finds the exit *by
  role*, so a tileset rebinding the exit char (`$`, `▶`, anything)
  playtests cleanly. `PlaytestScene` + the launcher thread the legend
  through. **Tests 97 → 104 (+7).**

- **M3 — tileset draw specs + frame cropping + decoration pass.**
  The bigger commit. `tileset.terrainFor`/`entityFor` change return
  shape from a bare `Image` to a draw spec `{image, sx, sy, sw, sh}`;
  new `decorationFor(char)` parallels them; a glyph entry's optional
  `frames` (≥1) and `frame` (≥0) drive a horizontal-strip crop
  (`sw = floor(width / frames)`, `sx = frame * sw`). The renderer's
  `blitImage` now forwards `sx/sy/sw/sh` into the 9-arg `drawImage`
  call. A new **Pass 4a** loops the grid for decoration chars and
  draws them via `decorationFor` *before* Pass 4b entities — so a
  player walking through trees reads as in front of the tree. Pass 4b
  guards its shape fallback on "neither entity nor decoration", so a
  decoration char never gets shape-double-drawn. **Tests 104 → 113
  (+9).** Critically, *zero data files changed in M3* — every spec
  defaults to full-image, matching v10's `drawImage` args exactly.
  Dirt + the four user packs hashed byte-identically after M3
  (`5172269f / eaee75b9 / b1d290f0 / cc816f5f / 368516be`).

- **M4 — Pixel Adventure 1 frames data.** The visible payoff. Two
  fields added to PA1's `tile_lookup.json`: `frames: 11` on Mask Dude
  (352×32), `frames: 17` on Apple (544×32). PA1's preview hash
  shifted from `b1d290f0…` to `f01ffb6b…` — the squashed strips
  finally became single idle poses. Other four tilesets unchanged,
  confirming `frames` is fully opt-in.

- **M5 — docs + transcript.** This file; design + impl marked
  Delivered with hashes.

## What stayed out (the explicit non-goals)

- **Multi-row tile atlases.** Treasure Hunters' palm-terrain PNG is
  544 × 160 (17×5). `frames` only slices horizontally; that pack
  still renders as a squashed strip in the editor preview. v12 needs
  a `cols × rows` schema and a 2D index.
- **Animated playback** of multi-frame sprites — v11 freezes on
  `frame` (default 0). Ticking the frame over time is v12 and adds a
  clock to the renderer.
- **State-changing exit** (`imageActive`) — small but unrelated to
  the variety theme; pair with a v12 polish.
- **Procedural-decor data** — Dirt's grass / moon / stars / drips
  rules remain hardcoded; lifting them into the lookup so other
  packs can declare their own is v12.
- **Multi-char terrain** — multiple solid materials with their own
  appearances; v11 still autotiles only `#`.
- **Legend grouping UI** — v11's legend lists every glyph entry
  flat. Collapsible "Pickups ▾" sections are v12 polish.

## A small commit-message scrape

M4's commit message landed with two backtick-wrapped instances of
`frames` stripped by the shell — single-quotes inside double-quoted
arguments don't quote backticks, so `` `frames` `` was attempted as a
command. The message now reads `(no  field needed)` with a double
space in that spot. The commit itself is correct; not worth a
force-push to fix message text alone. Lesson noted: in long commit
messages with literal markdown, use single quotes around the message
or escape the backticks.

## The standing gap

Same as v10: no automated DOM/canvas test for the editor's pipeline
beyond the Playwright harness. The pure parts are unit-tested under
`node --test`; the Playwright harness is the visible-rendering gate
(both *capture* — readable diffs in PRs — and *assert* — pairwise
preview-hash distinctness). v11 added 27 unit tests (86 → 113) and the
existing Playwright suite stayed green throughout.
