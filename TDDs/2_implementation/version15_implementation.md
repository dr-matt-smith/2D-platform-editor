# Version 15 — Implementation Plan

Status: **Delivered (M1–M3)** · Date: 2026-05-21 · Design:
[../1_design/version15_design.md](../1_design/version15_design.md) ·
Transcript: [../3_transcripts/version15_build.md](../3_transcripts/version15_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `9ccbbaa` | `launcher.js` cleanup — drop `SPRITE_KEYS`/`SPRITE_URL`/`STUB_COLOUR`/`stubSprite()`/loading loop; update overlay credit |
| 2 | `9c66d1b` | `git rm` the three PNGs; `git mv` `LICENSE` + `sources.md` into `src/play/`; rewrite `sources.md`; update `README` links (`src/play/README.md` + top-level `README.md` + `public/data/levels/README.md`) |
| 3 | _this commit_ | v15 transcript; design + impl Delivered |

Outcome: ~40 lines deleted in `launcher.js`; 3 PNGs removed from
the deploy; CC BY 4.0 attribution moved alongside the vendored
engine. Unit tests 131/0 unchanged; Playwright 11/11 unchanged; both
builds clean.

A pure cleanup. Three small path-scoped commits.

## Process (same discipline as v8–v14)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  is preserved.** Vendored entity `.draw()` methods and
  `AssetLoader.loadSprite`/`sprite`/`sprites` stay byte-identical
  even though dead from our caller's POV. v15 only touches **our
  own** code (`launcher.js`, our docs, our public/-served files).

## Constraints & approach

- Removing the launcher's sprite-loading machinery is safe **because
  v14 stopped calling the vendored entity `.draw()` methods**. The
  existing Playwright suite (preview-distinctness, playtest-by-
  tileset) is the regression backstop — the removed sprites were
  never displayed after v14, so visible behaviour cannot change.
- Moving attribution into `src/play/` keeps the CC BY 4.0 licence
  text alongside the code it applies to. There's no SEO / web-
  reachability requirement on the licence file; the repo carrying
  it is sufficient.

## Module map

| File | Change |
|------|--------|
| `src/play/launcher.js` | delete `SPRITE_URL`, `SPRITE_KEYS`, `STUB_COLOUR`, `stubSprite()`, and the sprite-loading loop; update credit line |
| `public/play-assets/player.png`, `coin.png`, `spike.png` | **deleted** |
| `public/play-assets/sources.md` | **moved** to `src/play/sources.md` and rewritten for the engine-only scope |
| `public/play-assets/LICENSE` | **moved** to `src/play/LICENSE` (text unchanged) |
| `src/play/README.md` | update LICENSE / sources references to be local |

## Milestone 1 — Launcher cleanup (code only)

1. `src/play/launcher.js`:
   - Delete the `SPRITE_KEYS`, `SPRITE_URL`, `STUB_COLOUR`,
     `stubSprite()` constants/function.
   - Delete the `for (const k of SPRITE_KEYS) { … }` block (and the
     comment block above it explaining the stub-then-real-sprite
     flow that no longer happens).
   - Update the overlay's HTML credit string from "Mechanic &
     sprites: simple-platformer-1 @4c3b936 · CC BY 4.0" to
     "Mechanic: simple-platformer-1 @4c3b936 · CC BY 4.0".
2. The launcher still imports `AssetLoader` (the vendored class is
   used for `assets.play('coin', { volume })` — Web-Audio
   synthesised pickup sound). The `assets = new AssetLoader()` line
   stays.
3. After this commit, browser dev-tools will show **zero** requests
   to `/play-assets/*.png` when Play is pressed. The PNGs still
   exist on disk and would still be served by Vite if requested —
   M2 removes the disk files.

Commit: `v15 m1: launcher cleanup — drop unused sprite-loading machinery`.

## Milestone 2 — Remove the public PNGs; move attribution to `src/play/`

1. `git rm "public/play-assets/player.png" "public/play-assets/coin.png" "public/play-assets/spike.png"` — the three PNG sprites.
2. `git mv "public/play-assets/LICENSE" "src/play/LICENSE"` — licence text unchanged.
3. `git mv "public/play-assets/sources.md" "src/play/sources.md"`, then **rewrite** the file to describe the new scope:
   - The vendored *engine* under `src/play/` (still CC BY 4.0 from
     `simple-platformer-1@4c3b936`).
   - The Web-Audio coin-synth recipe (vendored `AssetLoader.synth`).
   - A short historical note: "v9 vendored three PNG sprites
     (player/coin/spike) for the playtest. v14 made the editor
     renderer the single source of pixel truth for playtest;
     v15 removed the sprites since they were no longer drawn."
4. `public/play-assets/` directory will be empty → removed by git
   automatically.
5. `src/play/README.md`: change "see `../../public/play-assets/LICENSE`
   and `sources.md`" to "see `./LICENSE` and `./sources.md`".

Commit: `v15 m2: remove play-assets PNGs + move attribution into src/play/`.

## Milestone 3 — Docs + transcript + Delivered

`TDDs/3_transcripts/version15_build.md` (narrative, v8–v14 style);
mark design + impl Delivered with hashes.

Commit: `v15 m3: docs + v15 transcript; plan + design Delivered`.

## Risks & sequencing

- **Visible-behaviour regression is structurally impossible after
  v14**: the vendored entity `.draw()` methods aren't called, so
  the sprites they reference aren't drawn even when present. The
  Playwright preview-distinctness + playtest-by-tileset specs run
  every milestone as the back-stop.
- **The launcher's `assets.loadSprite(…).catch(() => {})` was
  swallowing 404s already** — even if someone re-runs v14 against
  a deploy where M2 has run and the PNGs are gone, the launcher
  silently degrades. v15 commits in M1→M2 order remove the calls
  first, then the files, so no transient 404 storm.
- **The licence file move is metadata-only** and doesn't change
  Pages behaviour. `public/play-assets/` was being served at
  `/play-assets/`; removing the directory removes those URLs from
  the deploy. Nothing on the live site links to them.

## Deferred (design §8 → v16+)

- Removing the vendored entity `.draw()` methods + `AssetLoader.
  loadSprite`/`sprite`/`sprites` / `loadLevel` / `levels`. Would
  break the §7 v9 byte-identical invariant; not done in v15.
- Animated playback over time, state-changing exit, multi-row tile
  atlas, keyboard nudge on splitters — all v15+ standing
  candidates carried over from prior versions.
