# Version 9 — Implementation Plan

Status: **Delivered (M1–M5)** · Date: 2026-05-19 · Design:
[../1_design/version09_design.md](../1_design/version09_design.md) ·
Transcript: [../3_transcripts/version09_build.md](../3_transcripts/version09_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`above_ground2.txt` / `manifest.json` never staged):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `25f543b` | vendor engine `@4c3b936` + `Goal`; 4 forks (logger/stop/dispose/clear); v9 TDDs |
| 2 | `bf54be7` | pure `adapter.toWorld` + `playtestGate`; 11 tests (55 → 66) |
| 3 | `cf31250` | `PlaytestScene` + gated modal launcher; scale-to-fit; teardown; main.js Play hook |
| 4 | `6f4abb3` | CC BY 4.0 `player/coin/spike.png` + `sources.md`/`LICENSE`; stub fallback; synth sfx |
| 5 | _this commit_ | levels README Playtest note; v09 transcript; plan + design Delivered |

Outcome: tests 55 → 66 (additions only — `adapter`/`playtestGate` are
pure; the editor pipeline is untouched so its suite is unchanged),
`npm run build` clean at every milestone. Engine vendored byte-identical
to upstream `@4c3b936` except the four audited §7 forks.

Playtest mode: vendor the `simple-platformer-1` engine, drive it from the
live edit buffer behind a gated modal overlay. **Additive and isolated** —
the editor's parse/validate/render/levels pipeline is untouched; playtest is
a read-only consumer of `parse(src.value)`.

## Process (same discipline as v8)

- **One milestone per commit.** Before each commit: `npm test` green,
  `npm run build` clean.
- **Path-scoped `git add` only — never `git add -A`.** The user is still
  authoring `public/data/levels/above_ground2.txt` and regenerating
  `public/data/levels/manifest.json`; those must never be swept into a v9
  commit. Stage explicit paths, then read `git status --short` as its own
  step before committing. (See memory: scoped-git-add.)
- Vendored physics files committed **byte-identical to upstream** except
  the four design §7 forks; the commit message for M1 lists those forks so
  the diff-from-upstream is traceable.

## Constraints & approach

- **The mechanic is imported, not authored.** `src/play/` is a vendored
  copy of `dr-matt-smith/simple-platformer-1`'s engine. v9's *own* logic is
  two **pure** modules (`adapter.js`, `playtestGate.js`, both
  `node --test`-ed) plus DOM glue (`launcher.js`, `playtestScene.js`,
  CSS) and a one-button hook in `main.js`.
- **Back-compat gate.** `level.js`/`validate.js`/`renderer.js`/`levels.js`
  are not modified → existing suite and the static preview are unchanged
  by construction.
- **Isolation gate.** Nothing in `src/play/` is imported by the editor's
  render/validate path; `main.js` only *calls into* the launcher. Removing
  `src/play/` + the button would fully revert v9.
- Pure-where-possible: `adapter`/`playtestGate` are DOM-free and tested;
  canvas/loop/overlay are dev-smoke (the standing v2 gap, unchanged).

## Module map

| File | Change |
|------|--------|
| `src/play/core/{game,scene,input,aabb,assets}.js` | **vendor**; forks: `game.stop()`+canvas-size clear, `input.dispose()` (design §7) |
| `src/play/entities/{player,platform,coin,spike}.js` | **vendor verbatim** |
| `src/play/constants.js` | **vendor** (keep `TILE`/`SPEED`/`JUMP_FORCE`/`GRAVITY`/`COLOURS`) |
| `src/play/logger.js` | **vendor as no-op shim** (keeps all importers verbatim, §7.1) |
| `src/play/entities/goal.js` | **new** — `Goal` exit AABB, shape-only |
| `src/play/adapter.js` | **new, pure** — parsed level → `{player,platforms,coins,spikes,goals,worldW,worldH}` |
| `src/play/playtestGate.js` | **new, pure** — `playtestGate(parsed, legend)` → `{ok,reasons}` wrapping `validate` |
| `src/play/playtestScene.js` | **new** — single-level scene (win/lose/restart/HUD/banners) |
| `src/play/launcher.js` | **new** — gate → overlay → asset preload → `Game` → teardown |
| `src/main.js` | `Play` button + Ctrl/Cmd+Enter + `Esc`; call launcher with `parse(src.value)` + active `legend` |
| `src/style.css` | `.playtest` modal + scale-to-fit canvas |
| `public/play-assets/` | `player.png`, `coin.png`, `spike.png`, `sources.md`, `LICENSE` (CC BY 4.0; coin sfx synthesised at runtime — no audio file) |

## Milestone 1 — Vendor the engine (+ Goal), no wiring

1. Copy upstream **commit `4c3b936`** `src/js/{core,entities}/*.js` +
   `constants.js` into `src/play/` preserving structure. Record the pinned
   hash in the M1 commit message for re-sync traceability.
2. Apply the **four** design §7 forks only:
   - `logger.js`: replace with a no-op shim
     (`export const logEvent=()=>{}; export const setScene=()=>{};
     export const clearLog=()=>{};`). Every other file keeps its
     `import … from "../logger.js"` unchanged.
   - `core/game.js`: add `this.running`; `start()` sets it `true`,
     `tick` early-returns when `false`, add `stop(){ this.running=false }`;
     change the clear to `this.ctx.clearRect(0,0,this.canvas.width,
     this.canvas.height)`.
   - `core/input.js`: keep handler refs; add
     `dispose(){ removeEventListener(...) }` for both listeners.
3. Add `src/play/entities/goal.js`: `Goal{ x,y,w=TILE,h=TILE; draw(ctx) }`
   drawing a framed marker in `COLOURS.accent` (mirrors `spike.js`
   structure; no asset).
4. No `main.js` change yet. `npm run build` must stay clean (tree-shaken;
   nothing imports `src/play/` yet).

Commit: `v9 m1: vendor simple-platformer-1 engine @4c3b936 + Goal (forks: stop/dispose/logger/clear)`.

## Milestone 2 — Pure adapter + gate (+ tests)

1. `src/play/adapter.js`: `toWorld(parsed, TILE)` →
   `{ player, platforms, coins, spikes, goals, worldW, worldH }` per design
   §4. Iterate `parsed.grid`; map `#/P/^/o/E`; ignore everything else;
   `worldW=meta.width*TILE`, `worldH=meta.height*TILE`. Pure, no imports
   from DOM; constructs vendored entity instances.
2. `src/play/playtestGate.js`: `playtestGate(parsed, legend)` →
   `{ ok, reasons[] }`. Runs `validate(parsed, legend)`; `ok=false` if any
   `severity==='error'`; additionally push a blocking reason
   `"playtest needs an exit (E)"` when no `E` in grid (promote the editor
   `warn` to a play blocker, design §4.1). `reasons` are `{line,col,message}`
   reusing validator issue shape so `main.js` can route them to the
   existing problems panel.
3. Tests (`src/play/adapter.test.js`, `src/play/playtestGate.test.js`,
   `node --test`):
   - adapter: spawn from `P`; N `#`→N platforms at `c*TILE,r*TILE`; `o/^/E`
     counts; unknown/`.`/space ignored; world size = dims×TILE; a level
     with 0 `o` yields `coins:[]`.
   - gate: clean level → `ok:true`; undefined glyph / two `P` / zero `P`
     → `ok:false` with reasons; **no `E`** → `ok:false` even though
     `validate` only `warn`s; a `warn`-only level (e.g. unrelated) with an
     `E` and one `P` → `ok:true`.

Commit: `v9 m2: pure playtest adapter + launch gate (tested)`.

## Milestone 3 — Scene + launcher + overlay (plays, shapes only)

1. `src/play/playtestScene.js extends Scene`: ctor takes the **snapshot**
   (`{player,platforms,coins,...,worldW,worldH}`) + an `onExit` cb.
   - `update(dt)`: `player.update(dt,this)` (the scene exposes
     `game.input` + `platforms`, matching upstream `Player`'s contract);
     coin overlap → `collected`+score; spike overlap or
     `player.y>worldH+50` → `dead`; all coins collected &&
     `rectsOverlap(player,goal)` → `won`; `R` → rebuild entities from the
     **stored snapshot** (deterministic restart, design §11).
   - `draw(ctx)`: bg fill, platforms/coins/spikes/goal/player, HUD
     (`coins: n / total`, "find the exit" once cleared), centred
     win/lose banner with `R restart · Esc exit`.
2. `src/play/launcher.js`: `launchPlaytest(parsed, legend)`:
   - `const g = playtestGate(parsed, legend); if(!g.ok) return g;`
     (caller surfaces `g.reasons`; overlay never opens).
   - Build overlay DOM (`.playtest` modal: canvas + toolbar
     Restart/Exit/hint). Canvas intrinsic = `worldW×worldH`.
   - `new Input()`, `new AssetLoader()`; **M3 uses shape fallback** (no
     assets yet — entities already degrade if `sprite()` is undefined; if
     upstream `draw` assumes a sprite, M3 passes a stub `assets.sprite`
     returning a 1×1 transparent canvas so shapes/rects show — confirm
     during M3 dev-smoke and adjust the Goal-style shape path).
   - `new Game({canvas,assets,input})`,
     `setScene(new PlaytestScene(snapshot,exit))`, `game.start()`.
   - `exit()`: `game.stop()`, `input.dispose()`, remove overlay, restore
     textarea focus. Bind `Esc` (and toolbar) → `exit`.
3. `src/main.js`: add `<button id="playBtn">` to the status bar;
   click & Ctrl/Cmd+Enter → `const r = launchPlaytest(parse(src.value),
   legend); if(r && !r.ok){ renderProblems([...issues, ...r.reasons]);
   flash problems panel; }`. `Esc` handled by the launcher while open.
4. `src/style.css`: `.playtest` fixed modal over the stage; canvas
   `max-width/height:100%`, preserved `aspect-ratio`,
   `image-rendering:pixelated` (scale-to-fit, design §5).
5. Dev-smoke: small + large + 12×8 levels; valid plays; error/no-E blocked;
   open/exit ×5 → no leaked loop (DevTools), no stuck key swallowing.

Commit: `v9 m3: playtest scene + gated modal launcher (scale-to-fit)`.

## Milestone 4 — Original CC BY 4.0 assets (sprites; synth sfx)

Upstream `4c3b936` made all media original and CC BY 4.0; the coin sound
is now **synthesised at runtime** (no file). This milestone is therefore
sprite-only + attribution; the sound needs *no* asset work (it ships in
the M1-vendored `assets.js`).

1. Copy the three original sprites `player.png`, `coin.png`, `spike.png`
   **and** `sources.md` **and** the upstream `LICENSE` (CC BY 4.0) into
   `public/play-assets/` (attribution + licence text, design §8). No
   `coin.mp3` — there is no audio file.
2. `launcher.js`: before `game.start()`,
   `await Promise.all([assets.loadSprite('player','/play-assets/player.png'),
   …'coin',…'spike'])`; brief "loading…" state in the overlay. **Sprite
   load failure → keep the M3 shape fallback** (engine degrades, never
   crashes). Note the sprite key is **`player`** (not the old `bean`).
3. Coin pickup sound: `assets.play('coin',{volume:.4})` on collect (as
   upstream `GameScene`). This drives the vendored `synth()`/Web-Audio
   `play()` — the lazy `AudioContext` is created on this first call, which
   occurs *after* the Play-button click (a user gesture), so autoplay
   policy is satisfied. No preload, no file.
4. Add a short credit line in the playtest overlay/about ("Mechanic &
   sprites: simple-platformer-1 @4c3b936, CC BY 4.0") to satisfy the CC BY
   attribution condition in-product as well as in `sources.md`.
5. Dev-smoke: sprites render; coin sfx plays once per pickup (and is
   silent, no error, if Web Audio is blocked); offline still plays with
   shapes if a sprite is missing; `Goal` stays a shape (no art).

Commit: `v9 m4: original CC BY 4.0 sprites + attribution; synth-sfx playtest`.

## Milestone 5 — Docs + transcript

`public/data/levels/README.md` note ("Play button — playtest the current
buffer; needs one P and an E"); `TDDs/3_transcripts/version09_build.md`;
mark design §ticked and this plan **Delivered** with commit hashes; design
§12 acceptance re-checked.

Commit: `v9 m5: docs + v09 transcript; plan Delivered`.

## Risks & sequencing

- **M1 is pure-vendor + 4 tiny forks** — independent, no behaviour in the
  app yet (tree-shaken). The fork list is the audit surface for a future
  re-sync; keep it to exactly the §7 four.
- **M2 is pure** — fully unit-tested; no DOM. The only subtlety is the
  *promoted* "no E" blocker (gate stricter than editor lint, by design
  §4.1) — covered by an explicit test.
- **M3 is the only behavioural integration.** Two upstream lifecycle gaps
  (`Game` never stops, `Input` never detaches) are real leak risks across
  repeated launches — mitigated by the §7 `stop()`/`dispose()` forks and
  an explicit open/exit ×5 dev-smoke. Risk: upstream entity `draw`
  assuming a non-null sprite — handled by the M3 stub-sprite step before
  M4 brings real art.
- **Scale-to-fit is CSS-only** — physics run in world units, the vendored
  engine is mathematically untouched; the editor already proves this
  pattern in its static preview.
- **No automated DOM/canvas test** for the overlay/loop — the standing v2
  gap. Mitigation: the *new logic* (`adapter`, `playtestGate`) is pure and
  unit-tested; the engine itself is a separately-shipped, upstream-tested
  game vendored byte-identical (minus §7); the integration is dev-smoked.
- **Asset licence** — *resolved upstream*. As of `4c3b936` all media is
  original and **CC BY 4.0** (kaplay/Bean and the prior "no AI-training"
  restriction removed). v9 only needs to carry attribution: vendor
  `sources.md` + the upstream `LICENSE` and show an in-product credit
  (M4.4). Not a code risk. (Pin is `4c3b936`; a future re-sync must
  re-check the licence still holds.)
- **Upstream renamed assets** — the sprite is now `player.png` (key
  `"player"`), not `bean.png`; the coin sound is synthesised, not a file.
  Vendored entity `draw()` already calls `sprite("player")`/`("coin")`/
  `("spike")` — keep the M1 vendor verbatim and the M4 paths/keys aligned;
  no extra fork.

## Deferred (design §13/§14 → v10)

Follow camera for large levels; one-way `=` platform end-to-end;
reachability lint; vendored-engine re-sync (shrink the §7 fork list if
upstream gains stop/dispose); playtest through the designer's own tileset
renderer instead of kaplay sprites.
