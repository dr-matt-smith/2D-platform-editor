# 2D Level Designer — Version 9 Design Document

Status: **Delivered** · Date: 2026-05-19 · Builds on:
[version08_design.md](version08_design.md) (v9 scope recorded there §13:
"play-test runtime") · Built:
[../2_implementation/version09_implementation.md](../2_implementation/version09_implementation.md)
(M1–M5, all §12 acceptance met) ·
[../3_transcripts/version09_build.md](../3_transcripts/version09_build.md)

## 1. Purpose

Let an author **play the level they are editing**, in the editor, using a
real platformer mechanic — without leaving the page, saving, or exporting.

The mechanic is **not written here**: it is the shipped game
`dr-matt-smith/simple-platformer-1` (a small custom engine — swept-AABB
player physics, scene loop, keyboard input). v9 **vendors that engine** into
the designer and drives it from the **current edit buffer** (live, including
unsaved changes), behind a "Play" button and a modal overlay.

Design stance: **the imported engine is the source of truth for the
mechanic** and is vendored as close to verbatim as possible. v9's own code
is a thin, pure **adapter** (designer grid → engine entities) plus the
overlay/launcher glue. The designer's parser, validator, renderer, and level
library are **untouched**.

## 2. Current state (what v9 adds)

- The designer has a *static* renderer only — no game loop, no physics.
  An author cannot tell whether a layout is *playable* (reachable exit,
  survivable gaps) without exporting it into the separate platformer repo.
- Level format glyphs: `.` Empty, `#` Filled, `P` Player spawn,
  `^` Hazard, `o` Pickup, `E` Exit (v8, tileset-derived legend).
- Levels are **arbitrary size** (`# size: WxH` or inferred).
- The imported platformer is hardcoded to a **fixed 32×20 single screen**,
  wins on **all coins collected**, has **no exit**, and its glyphs differ
  (`@` spawn, `$` coin, `=` thin platform). v9 reconciles all of this in
  the adapter; the engine files stay (almost) verbatim — see §7.

## 3. The mechanic, imported (`simple-platformer-1`)

Vendored under `src/play/` from upstream commit **`4c3b936`** ("Rename
project to drop kaplay/Bean association", 2026-05-19) — attribution carried,
§8. What it provides:

- `core/game.js` — `Game`: owns canvas + 2D ctx, the `requestAnimationFrame`
  loop, the active scene; `setScene()` swaps scenes.
- `core/scene.js` — `Scene` base (`enter/exit/update/draw`).
- `core/input.js` — `Input`: normalised keyboard (`isDown`/`wasPressed`).
- `core/aabb.js` — `rectsOverlap`, swept `resolveAxis` (pure).
- `entities/{player,platform,coin,spike}.js` — `Player` (gravity, single
  jump, **swept** vertical resolution so fast falls don't tunnel),
  `Platform` (solid AABB), `Coin` (pickup), `Spike` (lethal).
- `core/assets.js` — `AssetLoader` (sprites + **Web-Audio-synthesised**
  sfx; no audio files — see §8).
- `constants.js` — `TILE=20`, `SPEED`, `JUMP_FORCE`, `GRAVITY`, `COLOURS`.

This is the whole "mechanic". v9 keeps every physics file **byte-identical**
to upstream (the no-op `logger.js` shim, §7, is what makes that possible)
so the imported engine can be re-synced later with a clean diff.

## 4. Glyph & rule reconciliation (the adapter)

The designer's alphabet is mapped to engine entities by a **pure** adapter
`src/play/adapter.js` — `designer parsed level → { player, platforms,
coins, spikes, goals, worldW, worldH }`:

| Designer glyph | Engine result |
|---|---|
| `#` Filled | `Platform(x,y,TILE,TILE,"ground")` — full-tile solid |
| `P` Player spawn | `Player(x,y)` |
| `^` Hazard | `Spike(x,y)` — lethal |
| `o` Pickup | `Coin(x,y)` |
| `E` Exit | **`Goal(x,y)`** — new entity (§6) |
| `.` / space / other | background (ignored at play time) |

- `worldW = meta.width * TILE`, `worldH = meta.height * TILE`. Physics runs
  in these **world units** — the same units the imported engine uses — so
  no engine maths changes. Display scaling is **CSS-only** (§5).
- Unknown glyphs are ignored by the adapter; they are already an `error`
  in the editor's validator and the **launch gate** (§4.1) refuses to play
  a level with validation errors, so the adapter never meets one in
  practice. Ignoring (vs. throwing) keeps it total and pure.
- One-way / thin platform (`=`) is **out of scope** (deferred, §12). All
  designer terrain plays as full collision.

### 4.1 Win / lose / launch gate

- **Win** (decision §11): **all `o` collected, then touch an `E`**. With
  zero pickups, "all collected" is true from the start, so it reduces to
  *reach the exit*.
- **Lose**: touch a `Spike`, or fall below the world
  (`player.y > worldH + 50`, the upstream rule with `worldH` substituted
  for the upstream fixed `CANVAS_H`).
- **Launch gate** — playtest reuses the **existing** `validate(parsed,
  legend)`; no new lint logic. A pure `playtestGate(parsed, legend)`
  wraps it and decides *launchable*:
  - **Blocks** on any `error`-severity issue (e.g. undefined glyph,
    not exactly one `P`, declared-size mismatch).
  - **Additionally blocks** on **no `E`** — the editor only *warns* on a
    missing exit (a level can legitimately be a work in progress), but a
    playtest's win condition is unreachable without one, so the gate is
    deliberately **stricter than the editor lint**. This divergence is
    intentional and documented (§11).
  - `warn`-severity issues (other than the promoted "no exit") do **not**
    block.
  - On block: do not open the overlay; surface the blocking reasons in the
    existing problems panel and flash it (no new UI surface).

## 5. Viewport — scale-to-fit, no camera (decision §11)

The whole level is always visible; no scrolling camera.

- The play `<canvas>` **intrinsic** size is `worldW × worldH`, so the
  vendored physics and rendering run **unchanged** (it draws at world
  coordinates, exactly as upstream does at 640×400).
- The canvas **element** is scaled to fit the modal with **CSS only**
  (`max-width/max-height: 100%`, preserved `aspect-ratio`,
  `image-rendering: pixelated`). No `ctx` transform → zero physics impact.
  This is the same scale-to-fit pattern the editor's own static preview
  already uses, so it is proven in this codebase.
- Known trade-off: a very large level scales down small and the player
  sprite looks to move fast (world-unit speed is constant). Acceptable for
  v9; a real
  follow-camera is the **v10 candidate** (§12).

## 6. New entity — `Goal` (the `E` exit)

The imported engine has no exit; the designer has no exit *sprite*. Add
`src/play/entities/goal.js`: a tile-sized AABB drawn as a **shape**
(a distinct marker — e.g. a framed green door/flag using
`COLOURS.accent`), mirroring how `Spike`/`Coin` are structured and how the
designer already draws sprite-less entities. No new art, no asset licence
surface. `PlaytestScene` checks `allCoins && rectsOverlap(player, goal)`.

This is the **only** new gameplay code; it is small, shape-only, and does
not modify any vendored physics file.

## 7. Minimal, justified forks of vendored code

Everything in `src/play/` is upstream-verbatim **except** these, each
recorded so a future re-sync is a known, small diff:

1. **`logger.js` → no-op shim.** Upstream entities/scenes
   `import { logEvent } from "../logger.js"` and write `localStorage`
   event spam. The editor must not pollute the author's `localStorage`.
   Shipping a vendored `logger.js` whose `logEvent`/`setScene`/`clearLog`
   are no-ops keeps **every other vendored file byte-identical** (they
   import the shim unchanged). This is the cheapest possible fork.
2. **`Game.stop()`.** Upstream `start()` runs an unbounded
   `requestAnimationFrame` with no stop. An editor opens/closes playtest
   repeatedly; without a stop, every session leaks a live loop. Add a
   `running` flag: `start()` sets it, the tick checks it, `stop()` clears
   it. (~4 lines.)
3. **`Input.dispose()`.** Upstream `Input` adds `window` keydown/keyup
   listeners with no removal — repeated launches would stack global
   handlers (and keep swallowing space/arrows after exit). Add
   `dispose()` that removes them; the launcher creates one `Input` per
   session and disposes it on exit. (~5 lines.)
4. **`Game` clears the real canvas size.** Upstream `start()` does
   `clearRect(0,0,CANVAS_W,CANVAS_H)` (fixed constants). Vendored `Game`
   clears `0,0,this.canvas.width,this.canvas.height` so an arbitrary
   world size repaints fully. (1 line.)

The scene layer (`title/levelIntro/game/win/lose`) is **not** vendored:
upstream `GameScene` is bound to a multi-level manifest fetch, fixed
`CANVAS_H`, level progression, the logger, and win-on-all-coins. v9
instead writes **one** `src/play/playtestScene.js` — single level = the
in-memory snapshot, win/lose as in-scene banners (no manifest, no
progression), `R` = restart from the snapshot, `Esc` = quit (handled by
the launcher). Forking one small scene is cleaner and lower-risk than
bending the upstream one; the *physics* (the actual mechanic) is reused
verbatim.

## 8. Assets & licence

As of upstream `4c3b936`, **all media is original to the platformer repo
and released under CC BY 4.0** — the earlier kaplay/Bean sprites and
sampled `coin.mp3` were removed precisely because kaplay's licence carried
reuse restrictions. This makes the licence story clean:

- `Player`/`Coin`/`Spike` draw three original 32×32 sprites:
  **`player.png`** (note: renamed from the old `bean.png`; sprite key is
  `"player"`), `coin.png`, `spike.png`. Vendor them to
  `public/play-assets/`.
- **The coin pickup sound has no file** — it is **synthesised at runtime**
  with the Web Audio API in the vendored `AssetLoader` (`synth()`/`play()`,
  a short oscillator + gain-envelope recipe). Nothing to vendor; works
  fully offline; the lazy `AudioContext` is created on the first
  `play("coin")` *after* the launch click (a user gesture), satisfying
  autoplay policy. If Web Audio is unavailable, `play()` silently no-ops
  (upstream-handled) — sound is non-essential, never a crash.
- **Licence compliance**: CC BY 4.0 only requires attribution. Carry the
  upstream **`sources.md`** *and* the upstream **`LICENSE`** (CC BY 4.0
  full text + "Copyright (c) 2026 Matt Smith (dr-matt-smith)") into
  `public/play-assets/`, and credit the source repo. No use-restriction,
  no AI-training caveat — the prior concern is fully resolved upstream.
- The `Goal` marker is shape-only (no new art). If a sprite fails to load
  (bad deploy) entities fall back to shapes so playtest still runs — the
  engine degrades, never crashes (consistent with the renderer's existing
  atlas-fallback ethos).

## 9. UX

- **Entry**: a `Play` button in the existing status bar (beside
  `Levels`/`Download`), plus **Ctrl/Cmd+Enter**. A bare hotkey is *not*
  used — single keys are consumed by the textarea while authoring;
  Ctrl/Cmd+Enter never conflicts with typing.
- **What plays**: the **current buffer** (`src.value`), live — unsaved
  edits included. That immediacy (edit → play → edit) is the whole point.
- **Overlay**: a modal `<div class="playtest">` over the stage with the
  play `<canvas>` and a small toolbar — *Restart (R)*, *Exit (Esc)*, and
  a one-line controls hint (Arrows/Space, R, Esc).
- **In-play HUD**: `coins: collected / total` and, once all are collected,
  a "find the exit" cue; win/lose shown as a centred banner with
  *R restart · Esc exit*.
- **Exit**: `Esc` or the toolbar button → `game.stop()`, `input.dispose()`,
  remove the overlay, return focus to the textarea. The editor state is
  **never mutated** by playing (playtest is read-only on the buffer).

## 10. Architecture / impact

| File | Change |
|------|--------|
| `src/play/` (new) | Vendored engine: `core/{game,scene,input,aabb,assets}.js`, `entities/{player,platform,coin,spike}.js`, `constants.js`, `logger.js` (no-op shim) — verbatim except the §7 forks |
| `src/play/entities/goal.js` (new) | `Goal` exit entity (shape-only) |
| `src/play/adapter.js` (new) | **pure** designer parsed level → engine world; unit-tested |
| `src/play/playtestGate.js` (new) | **pure** `playtestGate(parsed, legend)` → `{ ok, reasons }`; wraps existing `validate`; unit-tested |
| `src/play/playtestScene.js` (new) | single-level scene: win/lose/restart, HUD, banners |
| `src/play/launcher.js` (new) | gate → build overlay → preload assets → run `Game` → teardown |
| `src/main.js` | add `Play` button + Ctrl/Cmd+Enter; on launch call the launcher with `parse(src.value)` + active `legend`; `Esc` exits. No change to parse/validate/render/levels flow |
| `src/style.css` | `.playtest` modal + scale-to-fit canvas rules |
| `public/play-assets/` (new) | `player.png`, `coin.png`, `spike.png`, `sources.md`, `LICENSE` (CC BY 4.0; no audio file — sfx synthesised) |
| `level.js` / `validate.js` / `renderer.js` / `levels.js` | **unchanged** |

**The one real wiring change**: `main.js` gains an isolated launch path
(gate → overlay → vendored `Game`) that never feeds back into the editor's
parse/validate/render pipeline. Playtest is a read-only consumer of
`parse(src.value)`.

## 11. Open questions — RESOLVED

- **Win condition** — **all `o` collected, then reach `E`** (user
  decision). Needs the new shape-only `Goal` entity (§6); `o` still
  scored. Locked.
- **Arbitrary size vs. fixed screen** — **scale-to-fit, no camera** (user
  decision). CSS-only scaling; physics in world units, vendored engine
  untouched (§5). Camera deferred to v10. Locked.
- **Thin/one-way `=` platform** — **deferred** (user decision). v9 maps
  only `#`,`P`,`^`,`o`,`E`; all terrain is full collision. Locked (§12).
- **Editor lint vs. play gate** — the gate is **stricter**: editor only
  *warns* on missing `E`, but playtest *blocks* on it (win is otherwise
  unreachable). Other `warn`s do not block; any `error` blocks. Reuses the
  existing `validate`; no new lint rules. Locked (§4.1).
- **What plays** — the **live current buffer** (unsaved edits included),
  not the saved/original level. The edit→play loop is the feature. Locked.
- **Win/lose presentation** — **in-scene banners** in one
  `PlaytestScene`, not vendored multi-scene Title/Win/Lose flow (no level
  progression here). Locked (§7).
- **Vendoring vs. submodule/npm** — **vendor** (copy under `src/play/`).
  The upstream repo is a teaching artifact with no published package; a
  vendored copy with carried attribution + the recorded §7 fork list keeps
  a future re-sync a known small diff. Locked.
- **Restart semantics** — `R` rebuilds entities from the **snapshot taken
  at launch**, not a re-parse of `src.value` (the buffer may have changed
  while the modal was open is impossible — the modal is blocking — but
  snapshot-at-launch keeps restart deterministic and the adapter call
  off the hot path). Locked.

## 12. Acceptance criteria

- A valid level (exactly one `P`, ≥1 `E`, no validation errors) → `Play`
  opens a modal; the player sprite spawns at `P`, gravity/jump/collision
  behave
  exactly as `simple-platformer-1`; collecting every `o` then touching an
  `E` shows **WIN**; a `^` or a fall shows **GAME OVER**; `R` restarts;
  `Esc` returns to the editor unchanged.
- A level with a validation `error`, or with **no `E`**, does **not** open
  the overlay; the blocking reasons appear in the existing problems panel.
- An arbitrarily sized level (e.g. 60×30 or 12×8) plays fully visible,
  scaled to the modal, with no camera and no physics distortion in world
  units.
- Opening and exiting playtest repeatedly leaks **no** rAF loop and **no**
  stacked key listeners (`Game.stop()` + `Input.dispose()` verified).
- Editor buffer, drafts, `localStorage`, and the static preview are
  unaffected by playing. Every vendored physics file is byte-identical to
  upstream except the four §7 forks. `npm test` green (new pure
  `adapter`/`playtestGate` units added), `npm run build` clean.

## 13. Non-goals (v9)

- Scrolling/follow camera (→ v10); v9 is scale-to-fit only.
- One-way / thin `=` platforms; moving platforms; enemies; checkpoints.
- Playtest using the **designer's tileset art** — playtest deliberately
  uses the imported engine's own (CC BY 4.0) sprite rendering: it tests
  *mechanics / playability*, not the visual theme (the static preview
  already covers the look).
- Multi-level progression, level intro splash, score persistence, the
  upstream event logger.
- Recording/replay, automated playability lint (reachability solver).

## 14. v10 candidates

- **Follow camera** at a fixed zoom for large levels (the natural next
  step once scale-to-fit's small-bean limit bites).
- One-way `=` platform glyph end-to-end (legend/validator/tileset +
  adapter mapping to upstream's `Platform("platform",h=14)`).
- Reachability lint (can the bean actually get from `P` to every `o` and
  to `E`?) — static analysis, no play required.
- Re-sync vendored engine from upstream (re-pin past `4c3b936`) and shrink
  the §7 fork list if upstream gains a `stop()`/`dispose()`.
- Playtest honouring the designer tileset (render the engine through the
  designer's renderer instead of the imported engine's sprites).
