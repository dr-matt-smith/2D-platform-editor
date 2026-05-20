# 2D Level Designer — Version 15 Design Document

Status: **Delivered** · Date: 2026-05-21 · Builds on:
[version14_design.md](version14_design.md) (which made the editor
renderer the single source of pixel truth for both preview and
playtest) · Built:
[../2_implementation/version15_implementation.md](../2_implementation/version15_implementation.md)
(M1–M3, all §7 acceptance met) ·
[../3_transcripts/version15_build.md](../3_transcripts/version15_build.md)

## 1. Purpose

v14 stopped using the v9 vendored playtest sprites — the editor
renderer paints the playtest now. The sprites under
`public/play-assets/` and the launcher's `loadSprite` machinery have
been **dead code since v14 merged**. v15 removes them.

A pure cleanup version. No new feature, no schema change, no
behaviour change. The acceptance criterion is "everything still
works, plus the dead pixels are gone".

## 2. What's still vendored after v14

| Asset / code | Status after v14 | v15 disposition |
|---|---|---|
| `public/play-assets/player.png` | not loaded; not drawn | **remove** |
| `public/play-assets/coin.png` | not loaded; not drawn | **remove** |
| `public/play-assets/spike.png` | not loaded; not drawn | **remove** |
| `public/play-assets/sources.md` | attribution metadata | **move to `src/play/`** + rewrite for the new scope |
| `public/play-assets/LICENSE` | CC BY 4.0 full text | **move to `src/play/`** (it still applies to the vendored engine code) |
| `src/play/launcher.js` `SPRITE_KEYS`, `SPRITE_URL`, `STUB_COLOUR`, `stubSprite()`, the loading loop | dead since v14 | **remove** |
| `src/play/launcher.js` "Mechanic & sprites:" credit line | text says "& sprites" but no sprites are loaded now | **edit** to "Mechanic: simple-platformer-1 @4c3b936 · CC BY 4.0" |
| `src/play/core/assets.js` `loadSprite()` / `this.sprites` | vendored byte-identical to upstream `4c3b936`; technically unused | **keep byte-identical** (v9 design §7 invariant: only four documented forks) |
| `src/play/core/assets.js` `synth()` / `play()` | **still live** — coin pickup sound | **keep** |
| `src/play/entities/{player,coin,spike}.js` `.draw()` methods | vendored byte-identical; reference `assets.sprite("…")`; PlaytestScene never calls them after v14 | **keep byte-identical** — dead code in *our* fork but live in upstream; touching them adds a fifth v9 §7 fork for no functional gain |
| `src/play/entities/{platform,goal}.js` `.draw()` methods | drawn from `COLOURS` (no sprite); never called by PlaytestScene after v14 | **keep byte-identical** |

The principle: **prune our own dead code freely; leave vendored
upstream byte-identical**. The v9 design §7 invariant ("vendored
code is byte-identical to upstream except the four documented
forks") still holds after v15.

## 3. Attribution after v15

The vendored *engine* under `src/play/` remains CC BY 4.0 from
`simple-platformer-1@4c3b936`. The licence file moves alongside it:

- `src/play/LICENSE` (was `public/play-assets/LICENSE`) — unchanged
  text.
- `src/play/sources.md` (was `public/play-assets/sources.md`) —
  **rewritten** to describe what's vendored now: the engine code +
  the Web-Audio coin-synth recipe. The PNG sprite paragraphs are
  removed (no sprites are vendored anymore).
- `src/play/README.md` — already documents the vendored engine; one
  link updated from `public/play-assets/LICENSE` to `./LICENSE`.

The in-overlay credit line in the playtest changes from
`Mechanic & sprites: simple-platformer-1 @4c3b936 · CC BY 4.0` to
`Mechanic: simple-platformer-1 @4c3b936 · CC BY 4.0` — accurate
to the new scope.

CC BY 4.0 compliance: attribution carried (sources.md + LICENSE +
in-product credit + repo README + design transcript history). No
new obligations.

## 4. Architecture / impact

| File | Change |
|------|--------|
| `src/play/launcher.js` | delete `SPRITE_URL`, `SPRITE_KEYS`, `STUB_COLOUR`, `stubSprite()`; delete the `for (const k of SPRITE_KEYS) { … }` block; update the overlay's credit text |
| `public/play-assets/player.png`, `coin.png`, `spike.png` | **deleted** |
| `public/play-assets/sources.md`, `LICENSE` | **moved** to `src/play/`; sources.md rewritten |
| `src/play/README.md` | update the LICENSE / sources links to be local |

Tests: no unit-test changes (the launcher is DOM-glue, not unit-
tested; the entity `.draw()` methods stay byte-identical). The
existing Playwright suite (11 specs) is the regression gate — the
preview-distinctness + playtest-by-tileset specs prove visible
behaviour is unchanged.

## 5. Non-impact (explicit)

- `level.js`, `validate.js`, `tileset.js`, `renderer.js`,
  `levels.js`, `history.js`, `splitter.js`, all of `src/play/core/*`
  and `src/play/entities/*` — unchanged.
- The level format, all `tile_lookup.json` files — untouched.
- The vendored engine remains byte-identical to upstream@4c3b936
  except the four §7 v9 forks (no fifth added).
- The Web-Audio coin pickup sound continues to work
  (`AssetLoader.synth('coin')` → `play('coin')` is untouched).
- The v12/v13 splitter and v14 tileset-aware playtest behaviour
  remain unchanged.

## 6. Open questions — RESOLVED

- **Touch the vendored entity `.draw()` methods?** — No. They're
  dead code in our fork but live upstream; trimming them adds a
  fifth v9 §7 fork for zero functional gain. The runtime cost of
  unused class methods is negligible. Locked.
- **Keep `assets.js` `loadSprite`/`sprite`/`this.sprites`?** — Yes.
  Same v9 §7 invariant. The lines exist; they just go un-called.
  Locked.
- **Move attribution to `src/play/`, or leave a stub in
  `public/play-assets/`?** — Move. There's no reason `public/`
  should carry attribution for code that lives in `src/play/`.
  Locked.
- **Rename `play-assets/` directory if any sprites come back later?**
  — A future "default playtest sprites for tilesets that don't
  authorise entity art" feature would re-introduce a sprite vendor,
  but the path would be a new design choice then (probably under a
  tileset or `public/data/default-sprites/`). v15 doesn't pre-empt
  it.

## 7. Acceptance criteria

- Playtest on each shipped tileset (Dirt, PWYP, Pixel Adventure 1,
  Treasure Hunters, 2D Circle Graphic) renders **byte-identically**
  to the post-v14 baseline (the editor renderer is doing the work;
  the removed sprites were never displayed anyway). Confirmed via
  the existing v14 Playwright distinctness spec.
- The launcher does not fetch `/play-assets/*.png` anymore (zero
  network requests for those paths).
- `public/play-assets/` no longer exists in the deployed build.
  `src/play/LICENSE` and `src/play/sources.md` do (committed in the
  repo; not bundled into `dist/` because they live under `src/`,
  not `public/`).
- The in-overlay playtest credit reads "Mechanic:
  simple-platformer-1 @4c3b936 · CC BY 4.0" (no "& sprites").
- `npm test` green; `npm run test:e2e` green (11/11 unchanged); both
  builds clean. Unit-test count unchanged (no new tests; no removed
  tests).

## 8. Non-goals + v16+ candidates

- **Removing the vendored entity `.draw()` methods** — would clean
  our fork further but break the §7 byte-identical invariant. If a
  future v16+ decides the invariant is too restrictive, that's the
  right time.
- **Pruning `AssetLoader.loadSprite` / `sprites` / `levels` /
  `loadLevel`** — same reasoning.
- **Animated playback** (frame cycling over time), **state-changing
  exit**, **multi-row tile atlas**, **keyboard nudge on splitters**
  — all standing v15+ candidates carried over from v11/v12/v13/v14.
- **A "default sprites for tilesets that don't authorise entity
  art"** path (would re-introduce a sprite vendor with a new design
  rationale). Not planned.
