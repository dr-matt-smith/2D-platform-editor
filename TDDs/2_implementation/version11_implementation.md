# Version 11 — Implementation Plan

Status: **Delivered (M1–M5)** · Date: 2026-05-20 · Design:
[../1_design/version11_design.md](../1_design/version11_design.md) ·
Transcript: [../3_transcripts/version11_build.md](../3_transcripts/version11_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md`
stayed out):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `4b0538b` | role resolver in `level.js` (V11_ROLES + ROLE_FROM_KEY + roleOf) + role-driven `validate.js`; 86 → 97 tests |
| 2 | `678dd12` | adapter + gate role-driven (`toWorld(parsed, legend, tile)`); multi-char hazards/pickups + `'@'` rebinding + decoration ignored; 97 → 104 tests |
| 3 | `1ef775d` | tileset accessors return draw specs `{image,sx,sy,sw,sh}`; `frames`/`frame` cropping; renderer Pass 4a decoration loop; 104 → 113 tests |
| 4 | `b93579d` | Pixel Adventure 1 `frames: 11` (Mask Dude) + `frames: 17` (Apple); PA1 preview hash `b1d290f0…` → `f01ffb6b…` |
| 5 | _this commit_ | v11 transcript; design + impl Delivered |

Outcome: tests 86 → 113 (+27). Playwright suite green throughout (2/2,
including the pairwise preview-hash distinctness assertion). Dirt +
2D Circle Graphic + PlayWithYourPeas + Treasure Hunters render
**byte-identically** to v10 — verified by md5 hash of the preview
canvases — confirming v11 is strictly additive.

Three composable additions on the v10 foundation: **multi-glyph roles**,
a **decoration** category, and **sprite-frame cropping**. Strictly
additive — Dirt + the four user packs render byte-identically without
edits; v11 only widens the schema and the role resolution path.

## Process (same discipline as v8–v10)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only — never `-A`.** Memory:
  [[scoped-git-add]]. The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` modifications stay out.
- Pure parts unit-tested under `node --test`; the visible canvas
  change is gated by the Playwright distinctness + per-tileset
  capture suite.

## Constraints & approach

- **Back-compat is the gate.** Every v10 `tile_lookup.json` must work
  unchanged. The role resolver (M1) maps legacy `role: "entity"` +
  glyph-key inference onto the v11 specific-role enum, so the legend
  produced for Dirt is *structurally identical* under both schemas.
  Renderer tests prove byte-identical Dirt pixels.
- **Single source of truth: `legend[char].role`.** Everything that
  used to switch on a literal char (`'P'`, `'E'`, `'^'`, `'o'`, `'#'`)
  routes through this. Hardcoded chars only remain in three places by
  design: `level.js`'s `BACKGROUND_GLYPH = '.'` (the void), the v8
  legacy-role-inference fallback table (M1), and the renderer's
  `tileMask`/`solid` helpers (`'#'` is the only autotiled terrain in
  v11; multi-char terrain is v12 — §13 of the design).
- **Decoration draws under entities.** Renderer Pass 4 is split into
  Pass 4a (decorations) + Pass 4b (entities), so a player walking
  through trees reads as "in front of the tree".
- **`frames` cropping is horizontal-strip only.** v11 freezes on
  `frame` (default 0) — no animation. Multi-row atlases and animated
  playback are v12+ (§13).

## Module map

| File | Change |
|------|--------|
| `src/level.js` | `buildLegend(lookup)` resolves each entry's `role` (v11-explicit wins; legacy fallback via the glyph-key inference table); legend entries gain a `role` field used by every downstream consumer |
| `src/validate.js` | role-driven counts: one `role:player`; ≥1 `role:exit`; ignore decorations; legacy-shape lookups continue to pass via the resolver |
| `src/tileset.js` | preload entity images by char; load optional `frames`/`frame`; `terrainFor(mask)` and `entityFor(char)` return a **draw spec** `{ image, sx, sy, sw, sh } \| null`; new `decorationFor(char)` symmetrically |
| `src/renderer.js` | `blitImage` consumes a draw spec; **Pass 4a** decoration loop (uses `decorationFor`); Pass 4b entities unchanged |
| `src/play/adapter.js` | `toWorld(parsed, legend, tile=TILE)` — switches on `legend[char].role`; decorations ignored |
| `src/play/playtestGate.js` | find an exit by role, not literal `'E'` |
| `src/play/playtestScene.js` | passes the legend through to `toWorld` |
| `src/play/launcher.js` | hands `legend` to the scene constructor |
| `src/main.js` | unchanged data flow (legend already flows everywhere it's needed) |
| `public/data/tilesets/Pixel Adventure 1/tile_lookup.json` | M4: add `frames` counts to Mask Dude (`11`) and Apple (`17`); no glyph-set changes |
| `tests/tileset-screenshots.spec.js` | extended capture: the Pixel Adventure 1 pane now shows a single frame; distinctness assertion still holds |

## Milestone 1 — Role resolver + role-driven validator (pure)

1. `src/level.js`:
   - Define a `ROLE_FROM_KEY = { empty: 'background', filled: 'terrain', player: 'player', exit: 'exit', hazard: 'hazard', pickup: 'pickup' }` table for legacy inference.
   - Extend `buildLegend(lookup)`: for each `glyphs` entry, compute
     `role = v11.includes(g.role) ? g.role : (ROLE_FROM_KEY[key] ?? 'unknown')`
     where `v11 = ['background','terrain','player','exit','hazard','pickup','decoration']`.
   - Legend entries gain `role` (kept alongside `name`, `image`, `color`).
   - Also expose a small helper `roleOf(legend, char) → role | null`
     for downstream consumers; null when the char isn't in the legend.
2. `src/validate.js`:
   - Replace literal `'P'` count with "exactly one cell whose
     `roleOf(legend, char) === 'player'`".
   - Replace `'E'` warning with "≥1 cell whose role is `exit`".
   - Glyph-set check unchanged (uses legend chars).
   - Validator continues to take an optional `legend` defaulting to
     `DEFAULT_LEGEND` (v8 contract).
3. Tests: `src/level.test.js` extended with the role resolver (legacy
   `role: "entity"`, explicit `role: "pickup"`, unknown role → falls
   back to key inference, completely-unknown key → `'unknown'`).
   `src/validate.test.js` extended with a multi-char-hazard lookup
   passing validation; a no-`player`-role lookup failing.

Commit: `v11 m1: role resolver + role-driven validator (pure, tested)`.

## Milestone 2 — Adapter + gate role-driven

1. `src/play/adapter.js`:
   - `toWorld(parsed, legend, tile = TILE)` — signature change.
     `legend` is now required (v9 was already passing it everywhere).
   - Switch on `roleOf(legend, char)`:
     - `'terrain'` → `new Platform(x, y, tile, tile, 'ground')`
     - `'player'` → `new Player(x, y)` (still: exactly one expected)
     - `'hazard'` → `new Spike(x, y)`
     - `'pickup'` → `new Coin(x, y)`
     - `'exit'`  → `new Goal(x, y)`
     - `'decoration'` / `'background'` / unknown → ignored
   - Pure; no DOM.
2. `src/play/playtestGate.js`:
   - Replace `row.includes('E')` with "any cell whose
     `roleOf(legend, char) === 'exit'`".
   - Same blocking semantics (errors + promoted no-exit).
3. `src/play/playtestScene.js`:
   - Constructor takes `legend` alongside `parsed`; passes it to
     `toWorld` in `restart()`.
4. `src/play/launcher.js`:
   - Forwards `legend` to the scene constructor.
5. Tests (`src/play/adapter.test.js`, `playtestGate.test.js`):
   - Multi-char pickup level (`o`/`O` both pickups) → coins count
     equals 2.
   - Multi-char hazard → spikes count equals 2.
   - Decoration glyph → no entity built; level still launchable.
   - Legacy-shape legend (no explicit role) still produces the v10
     behaviour exactly (regression).

Commit: `v11 m2: adapter + gate role-driven (legend-aware, tested)`.

## Milestone 3 — Tileset draw specs + renderer frame cropping + decoration pass

1. `src/tileset.js`:
   - When parsing each glyph entry, read optional `frames` (≥ 1) and
     `frame` (≥ 0); after loading the image, compute a draw spec:
     `sw = Math.floor(im.width / frames)`, `sh = im.height`,
     `sx = frame * sw`, `sy = 0`. For `frames === 1` (default) the
     spec is `{image, 0, 0, im.width, im.height}`.
   - Index entity images by char as today, **storing the spec** (not
     the bare Image).
   - Build a parallel `decoration` index — entries with
     `role === 'decoration'` go here (so the renderer can iterate
     decorations cheaply in Pass 4a).
   - Accessors:
     - `terrainFor(mask) → spec | null` (spec wraps the legacy/new
       chain from v10; no `frames` support on terrain in v11 — kept
       simple, no `frame` validation needed).
     - `entityFor(char) → spec | null`
     - `decorationFor(char) → spec | null` (returns null for non-
       decoration chars even if the char exists elsewhere)
   - **Warn-not-error** on `frames` not dividing `image.width`:
     `console.warn(...)`; usable strip is `Math.floor(width/N) × N`
     (the right edge is ignored). Loader still resolves.
2. `src/renderer.js`:
   - Replace the `blitImage` helper:
     `ctx.drawImage(spec.image, spec.sx, spec.sy, spec.sw, spec.sh, x, y, t, t)`.
   - Pass 2 (terrain) and Pass 4b (entities) — same logic, new
     accessor shape.
   - **Pass 4a (decorations)** — for each non-`.`/non-`#` cell where
     `tileset?.decorationFor?.(g)` returns non-null, draw it (using
     `blitImage`); the existing Pass 4b skips that cell because
     `entityFor` returns null for decoration chars.
3. Tests (`renderer.test.js`):
   - Update the fakeTileset to return `{image:{width,height},
     sx:0, sy:0, sw, sh}` specs.
   - New cases: a glyph with `frames: 4` and `frame: 2` results in
     `sx === 2*sw`; a decoration char draws via `decorationFor`,
     never `entityFor`.
   - Dirt byte-identical: tests assert the same draw-call counts &
     args as v10.

Commit: `v11 m3: tileset draw specs + frame cropping + decoration pass`.

## Milestone 4 — Pixel Adventure 1 frames data + Playwright re-capture

1. `public/data/tilesets/Pixel Adventure 1/tile_lookup.json`:
   - `glyphs.player.frames: 11`   (Mask Dude/Idle (32×32).png = 352×32)
   - `glyphs.pickup.frames: 17`   (Apple.png = 544×32)
   - Other glyphs unchanged (single-frame already).
2. Playwright capture re-runs; verify Pixel Adventure 1's preview pane
   now shows a single Mask Dude / Apple frame each cell instead of a
   strip. Hash will change — update the v10 distinctness assertion's
   expectations (it asserts pairwise distinctness, not specific
   hashes; should remain green without code change).
3. No `tile_lookup.json` change for the three other user packs — their
   art is already mostly single-frame; if anything else surfaces as a
   strip, fold it into the M5 commit or hold for v12.

Commit: `v11 m4: Pixel Adventure 1 frames (Mask Dude=11, Apple=17)`.

## Milestone 5 — Docs + transcript + Delivered

`TDDs/3_transcripts/version11_build.md` (narrative, v8–v10 style);
mark design + impl Delivered with commit hashes; tick acceptance.

Commit: `v11 m5: docs + v11 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 and M2 are pure** — covered by unit tests; no DOM. The role
  resolver is the leverage point — if its legacy-fallback table is
  wrong, multiple consumers misbehave together. Test that fallback
  exhaustively against the v10 `DEFAULT_LEGEND` (the assert: the v11
  resolver applied to it yields the same role per char as the v10
  hardcoded mapping).
- **M3 is the visual integration.** Risk: a Dirt subtle pixel diff
  from re-routing through draw specs. Mitigation: for Dirt every
  spec collapses to `{image, 0, 0, im.width, im.height}`, identical
  to v10's `blitImage` arguments. Renderer test asserts this exactly.
- **M3 contract change** (`terrainFor`/`entityFor` shape) means the
  v10 renderer + tileset tests' fakeTileset must update in the same
  commit — that's the right scope (it's the contract that changes,
  not the behaviour).
- **M4 is data-only** but the user "owns" `tile_lookup.json` files.
  The frame counts are derived from file dimensions, not invented —
  Mask Dude 352/32 = 11; Apple 544/32 = 17. No room for
  disagreement. Still: stage path-scoped, surface the diff in the
  commit message for review.
- **No deploy risk.** The bundle gains a few hundred bytes (role
  resolver + frame cropping + decoration pass); Pages workflow is
  unchanged. Live URL stable.

## Deferred (design §13 → v12)

- **State-changing exit** (`imageActive` swapped by the playtest Goal
  once all pickups in).
- **Animated playback** — tick `frame` over time at render time
  (needs a clock; renderer becomes time-dependent).
- **Multi-row tile atlases** — 2D index for sheets like the Treasure
  Hunters palm-terrain 17×5.
- **Procedural-decor data** — Dirt's grass/moon/stars/drips rules
  lifted into `lookup.decor` so other packs can declare their own.
- **Multi-char terrain** — different solid materials with their own
  appearances; needs the renderer to autotile per-material.
- **Auto-picked cosmetic variants** — same char, hash-picked image.
- **Convention-based autotile discovery**.
- **Legend grouping UI** — collapsible role sections.
