# Transcript — Version 9: Playtest Mode

A narrative record of the v9 phase: making the editor's levels **playable
in place** by vendoring an existing platformer as the mechanic, behind a
gated modal — with **zero engine authorship** and the editor pipeline
untouched. Decisions and rationale, in order.

## The brief

v8 §13 already earmarked "play-test runtime" for v9. The user asked to
pull in `dr-matt-smith/simple-platformer-1` "to use as the mechanic" and
add a playtesting mode, with design + implementation TDDs to review first.

Studying both codebases surfaced three real mismatches the design had to
resolve, not paper over: the two formats use **different glyphs**
(`@/$/=` vs `P/o/#/^/E`), the platformer is hardcoded to a **fixed 32×20
screen** while designer levels are arbitrary size, and the platformer has
**no exit** (it won on all-coins). Three questions were put to the user
and locked: **win = collect all `o`, then reach `E`**; **scale-to-fit, no
camera**; **defer the one-way `=` platform**.

## A licence pivot mid-review

After the TDDs were written, the user pushed a new upstream commit and
asked to re-pin: `4c3b936` ("Rename project to drop kaplay/Bean
association"). The old kaplay sprites + sampled `coin.mp3` (MIT-with-
restrictions, "no AI-training") were **replaced by original artwork under
CC BY 4.0**, and the coin sound is now **synthesised at runtime** via Web
Audio (no audio file at all). The docs were updated: the prior licence
caveat became *resolved upstream*; obligation reduced to carrying
attribution; the sprite key is now `player` (was `bean`); pinned hash
recorded for re-sync traceability.

## The design stance

The mechanic is **imported, not authored**. `src/play/` is upstream
vendored as close to byte-identical as possible so a future re-sync is a
clean diff; v9's own code is two **pure** modules (`adapter`,
`playtestGate`) plus DOM glue. The editor's `level.js`/`validate.js`/
`renderer.js`/`levels.js` are not modified — playtest is a read-only
consumer of `parse(src.value)`. Removing `src/play/` + the button fully
reverts v9.

## Build

- **M1 — vendor + Goal.** `core/{aabb,scene,input,game,assets}.js`,
  `entities/{player,platform,coin,spike}.js`, `constants.js` copied from
  `@4c3b936`. Exactly four documented forks (design §7): a **no-op
  `logger.js` shim** (keeps every other file byte-identical instead of
  editing call sites — the cheapest possible fork; the editor must not
  spam the author's `localStorage`); `Game.stop()` + a `running` flag +
  clearing the canvas at its real size, not fixed `CANVAS_W/H` (an
  unbounded rAF loop leaks across repeated open/close, and arbitrary
  worlds must repaint fully); `Input.dispose()` (window key listeners
  stacked otherwise). One v9-original entity: `Goal` (the `E` exit),
  shape-only — the designer ships no exit art. No wiring; tree-shaken so
  the build stayed clean.

- **M2 — pure adapter + gate.** `adapter.toWorld(parsed, tile)` maps the
  grid to vendored entities in TILE-px world units (so the imported
  physics maths is unchanged), ignoring unknown/background glyphs to stay
  total. `playtestGate(parsed, legend)` **reuses the existing `validate`**
  — no new lint — blocking on any `error`, and deliberately **promoting
  the editor's non-blocking "no exit" warning to a hard block** because
  the win is unreachable without an `E`. 11 `node --test` cases; suite
  55 → 66, no churn to existing tests (both modules DOM-free).

- **M3 — scene + launcher + overlay.** Upstream's Title/Game/Win/Lose
  flow was *not* vendored: it is bound to a multi-level manifest fetch,
  fixed canvas, progression and the logger. One `PlaytestScene` instead
  — single level = the launch snapshot, win/lose as in-scene banners,
  `R` rebuilds from the snapshot deterministically (a fresh `toWorld`),
  off-world death uses `worldH`, not the upstream fixed `CANVAS_H`. The
  launcher gates first (blocked → problems panel flashes, no overlay),
  else opens a modal whose canvas keeps its **world-pixel intrinsic
  size** and is **CSS scale-to-fit** (a replaced element preserves aspect
  ratio — the same trick the editor's static preview already uses, so the
  physics is mathematically untouched). Teardown is explicit:
  `game.stop()` + `input.dispose()` + listener/overlay removal + focus
  restore; a single-instance guard stops a second Ctrl/Cmd+Enter stacking
  a second `Game`. `Esc` is launcher-owned (capture phase) because
  upstream `Input` doesn't normalise it.

- **M4 — CC BY 4.0 assets.** `player/coin/spike.png` (32×32, original) +
  `sources.md` + the upstream `LICENSE` vendored to
  `public/play-assets/`. The launcher renders flat-colour stubs first
  (instant first frame) and swaps in each PNG as it loads; a failed load
  keeps the stub, so playtest still runs offline — the engine degrades,
  never crashes. The coin pickup is **synthesised** by the vendored
  `AssetLoader` on first `play()` (after the launch click — a user
  gesture — so autoplay policy is satisfied); no audio asset, no preload
  gate. An in-overlay credit line satisfies the CC BY attribution
  condition in-product as well as in `sources.md`.

- **M5 — docs + transcript.** Levels README "Playtest" section; this
  transcript; design + implementation marked Delivered with hashes.

## What stayed out (v10)

A follow camera for large levels (scale-to-fit's small-sprite limit is
the natural trigger), the one-way `=` platform end-to-end, a reachability
lint (can the player actually get `P` → every `o` → `E`?), re-syncing the
vendored engine to shrink the §7 fork list, and playing through the
designer's own tileset renderer instead of the imported sprites.

## The standing gap

No automated DOM/canvas test for the overlay/loop — the same gap since
v2. Mitigation held: the *new* logic (`adapter`, `playtestGate`) is pure
and unit-tested; the engine is a separately-shipped, upstream-tested game
vendored byte-identical bar the four audited forks; the integration is
dev-smoked. `npm test` 66 green and `npm run build` clean at every
milestone; every commit path-scoped (the user's in-flight
`above_ground2.txt` / `manifest.json` never swept in).
