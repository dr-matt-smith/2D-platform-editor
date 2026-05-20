# Transcript — Version 15: Cleanup of the Unused play-assets Vendor

A narrative record of the v15 phase: a pure cleanup. After v14 made
the editor renderer the single source of pixel truth for both
preview and playtest, the v9 vendored PNG sprites and the launcher's
sprite-loading machinery became dead code. v15 removed them.

## The brief

The user asked: "create v15 to clean up the unused play-assets
vendor". One sentence. Zero ambiguity once you know what v14 left
behind.

## The principle that shaped the scope

The v9 design §7 invariant — *vendored `src/play/` code stays
byte-identical to upstream `simple-platformer-1@4c3b936` except the
four documented forks* — is the project's biggest re-syncability
guarantee. Without it, every future re-pin would be archaeology;
with it, a `git diff src/play/` against upstream is a known small
set.

That invariant constrained v15: tidy **our own** code, but **leave
vendored upstream byte-identical** even when it's dead from our
caller's POV. The vendored entity `.draw()` methods reference
`assets.sprite("…")` and would throw at runtime if anything called
them post-v15 — but nothing does, so they're just unreachable code
paths. Same with `AssetLoader.loadSprite` / `sprite` / `levels` /
`loadLevel`: dead in our fork, live upstream, byte-identical here.

So v15 split into two surfaces:

- **Our own code** — the launcher's sprite-loading stack, the
  overlay credit text, the asset PNGs we ourselves placed under
  `public/play-assets/`, the attribution metadata we ourselves
  authored. **All fair game to prune.**
- **Vendored code** — the four entity files, `AssetLoader`'s sprite
  methods. **Hands off.**

## Build

- **M1 — launcher cleanup (code only).** Deleted `SPRITE_KEYS`,
  `SPRITE_URL`, `STUB_COLOUR`, `stubSprite()`, the stub-then-real-
  sprite loading loop, and the now-pointless `BASE` constant in
  `launcher.js` (sprite-URL-only consumer). Updated the overlay
  credit text from "Mechanic & sprites: …" to "Mechanic: …" —
  accurate to the new scope (no sprites loaded). `AssetLoader` kept;
  `assets.play('coin', {volume})` continues to route through the
  vendored `synth()` for the Web-Audio pickup sound. After M1,
  browser DevTools shows zero requests to `/play-assets/*.png` when
  Play is pressed; the PNGs still on disk are simply not requested.
  Tests + Playwright + builds unchanged (the regression backstop —
  the v14 distinctness + playtest-by-tileset specs — proves the
  visible behaviour is unchanged).

- **M2 — delete PNGs, move attribution.** `git rm` the three PNGs;
  `git mv` `LICENSE` and `sources.md` from `public/play-assets/`
  into `src/play/` (next to the code they describe). `sources.md`
  rewritten for the new scope (engine + Web-Audio synth recipe;
  no PNG sprite paragraphs; historical note pointing at v9/v14/v15
  for "what happened to the sprites?"). `src/play/README.md`
  updated to link the local LICENSE / sources files. The (briefly
  empty) `public/play-assets/` directory `rmdir`-ed (Git doesn't
  track empty dirs so this is metadata-only).

  Two stale references caught on a final grep: the top-level
  `README.md` listed `public/play-assets/` in the project layout
  and again in the Licence section; `public/data/levels/README.md`
  pointed at `public/play-assets/{sources.md,LICENSE}` in its
  Playtest section. Both updated to point at `src/play/`, with a
  short v14/v15 history note in the top-level README so future
  contributors have the breadcrumb.

- **M3 — docs + transcript + Delivered.** This file; design + impl
  marked Delivered with hashes.

## What didn't change

The aggressive non-touch list:

- `src/play/{core,entities}/*` — byte-identical to upstream
  `@4c3b936` except the four §7 forks (no fifth added).
- `src/play/constants.js`, `src/play/logger.js` — unchanged.
- `src/play/adapter.js`, `playtestGate.js`, `playtestScene.js` —
  unchanged (these are v9+-original, not vendored, but v15 doesn't
  touch their drawing flow either — v14 already did the right
  thing).
- `src/level.js`, `validate.js`, `tileset.js`, `renderer.js`,
  `levels.js`, `history.js`, `splitter.js` — unchanged.
- All `tile_lookup.json` files, the level format, the editor's
  static preview pipeline — unchanged.
- The Web-Audio coin pickup sound — still works (`AssetLoader.
  synth('coin')` → `play('coin')`).

## Net code change

Roughly **−40 lines** in `launcher.js` (stub helpers + loading loop
+ a comment block), zero lines added in any prod source file
except a small rewrite of `src/play/sources.md`. The bundle shrinks
by a handful of bytes (the stub-canvas function + the colour
constants + the URL builder) and Pages no longer serves three PNGs.

## What stayed out

Standing v15+ candidates carried forward to v16+:

- **Trimming the vendored entity `.draw()` methods** and
  `AssetLoader.loadSprite/sprite/sprites/levels/loadLevel`. Would
  break the §7 byte-identical invariant. The right time is when /
  if a future re-pin to a different upstream commit makes the
  invariant impossible to keep anyway.
- **Animated playback** (frame cycling over time).
- **State-changing exit** (`imageActive` when all pickups in).
- **Multi-row tile atlas** (Treasure Hunters palm-terrain 17×5).
- **Keyboard nudge** on the v12/v13 splitters.
- **Default sprites for tilesets that don't authorise entity
  art** — would re-introduce a sprite vendor with a new design
  rationale. Not planned.

## The standing gap

Same as v13/v14 — no automated DOM-mutation test of the broader
interactive surface beyond Playwright. v15 added no specs (it's
pure cleanup; the visible behaviour is structurally locked). The
Playwright suite (11 specs) is the regression backstop and is
green.
