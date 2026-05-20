# 2D Level Designer — Version 14 Design Document

Status: **Delivered** · Date: 2026-05-21 · Builds on:
[version13_design.md](version13_design.md) (splitter arc concluded) ·
Built:
[../2_implementation/version14_implementation.md](../2_implementation/version14_implementation.md)
(M1–M3, all §7 acceptance met) ·
[../3_transcripts/version14_build.md](../3_transcripts/version14_build.md)

## 1. Purpose

The editor's **preview** shows the level rendered with the active
tileset's art (terrain mask, sprites, decorations, sprite-frame
cropping — everything v10–v11 landed). The editor's **playtest**, on
the other hand, still uses the kaplay-style sprites vendored from
`simple-platformer-1` (a fixed `player.png` / `coin.png` /
`spike.png`, drawn by the vendored `Player`/`Coin`/`Spike` `.draw()`
methods). The two views diverge: the level you're *looking at* and
the level you *play* are visually different.

v14 closes that gap: when the author presses **Play**, the level
they're looking at is what they play. The editor renderer becomes
the **single source of pixel truth** for both modes; the playtest
engine retains its role as the source of *physics + state truth*.

A single focused feature, naturally bracketed.

## 2. Current state

`src/play/playtestScene.js` `draw(ctx)`:

```js
for (const p of this.platforms) p.draw(ctx);
for (const g of this.goals)     g.draw(ctx);
for (const c of this.coins) if (!c.collected) c.draw(ctx, this.game.assets);
for (const s of this.spikes)    s.draw(ctx, this.game.assets);
this.player.draw(ctx, this.game.assets);
```

Each vendored entity's `.draw()` does
`ctx.drawImage(assets.sprite("<key>"), …)` — pulling the play-assets
art. The active tileset (legend, masks, glyph images, decorations,
frame counts) is completely ignored.

## 3. The approach: "render the view grid, overlay the player"

The editor renderer (`src/renderer.js` `draw(ctx, parsed, tileset,
tile)`) already knows how to render a parsed level with the active
tileset:

- Background fill / atlas sky tile.
- Terrain autotile via `terrainFor(mask)` (Dirt mask table; legacy
  `filled`; tileset `terrain.default`; or `glyphs.filled.image`).
- Decor pass (Dirt-atlas only, by design).
- Decorations via `decorationFor(char)` (v11 Pass 4a).
- Entities via `entityFor(char)` with sprite-frame cropping (v11).
- Shape fallback for any glyph the tileset doesn't authorise.

In playtest, **almost** everything stays cell-aligned: terrain
doesn't move, coins disappear (cell becomes empty), spikes don't
move, decorations don't move, the exit doesn't move. **Only the
player moves continuously** (its `x,y` are physics-driven floats).

So every frame:

1. Build a **view grid** = a shallow clone of the parsed grid with:
   - The player's spawn cell replaced by `.` (so the renderer
     doesn't draw `P` at the spawn position underneath the moving
     player).
   - Every **collected coin's** cell replaced by `.` (so collected
     coins vanish on the canvas, mirroring the engine's `.collected`
     state).
2. Call `editorRender(ctx, { grid: viewGrid, meta: parsed.meta },
   tileset, TILE)` — the editor's renderer paints terrain + decor +
   uncollected coins + spikes + exit + decorations in the active
   tileset's style.
3. Overlay the **player sprite** at its precise float position
   (`player.x`, `player.y`, size = TILE × TILE):
   - Try `tileset.entityFor(playerChar)` → spec → cropped sprite.
   - Else → the same `drawFallback('P', …)` the editor uses for
     image-less player glyphs (e.g. Dirt's blue disc). The fallback
     is exported from `renderer.js` for symmetric reuse.
4. Draw the HUD + win/lose banner last, exactly as today.

That's the whole feature. ~30 lines of `playtestScene.draw` replaced
by a half-dozen lines that delegate to the editor renderer.

## 4. What this means per tileset

Every shipped tileset gets the playtest art it already gets in the
editor preview:

- **Dirt** — terrain: full 16-mask autotile + decor (grass/moon/
  stars/drips). Entities (P/E/^/o): shape fallbacks (blue disc,
  green block, red triangle, yellow dot) because Dirt's lookup
  declares `image: null` for them. Decorations: none in Dirt.
- **PlayWithYourPeas** — terrain: Block-Normal default tile. Pea
  player, Goal flag, Trap alert, Happy point. All single-frame.
- **Pixel Adventure 1** — terrain: Crate default tile. Mask Dude
  (frame 0 cropped), Apple (frame 0), Checkpoint, Spikes. Sky
  background tile.
- **Treasure Hunters** — terrain: Palm-Island terrain sheet
  (currently squashed; multi-row atlas support is the v15+
  candidate). Captain (single frame), Gold Coin, Seashell, no exit
  image → green-block fallback.
- **2D Circle Graphic** — pavement terrain, door exit, shape
  fallbacks for the player/coin/hazard glyphs.

Multi-glyph categories: each pickup char (apple/cherry/banana, etc.)
renders its own image via the editor renderer's entity pass — the
adapter still collapses them all to `Coin` entities for the win
counter, but the *visuals* are per-char.

Decoration glyphs: rendered by the editor renderer's Pass 4a,
inert at the playtest level (the adapter already ignores them).

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/main.js` | passes the active `tileset` object to `launchPlaytest(parsed, legend, tileset)` |
| `src/play/launcher.js` | accepts `tileset` and forwards it to `PlaytestScene`'s constructor |
| `src/play/playtestScene.js` | constructor stores `tileset`; `draw(ctx)` rewritten to build viewGrid + call editor renderer + overlay player |
| `src/renderer.js` | exports `drawFallback(ctx, glyph, x, y, t)` so the player overlay can reuse the same shape-fallback path the editor preview uses (Dirt's blue disc) |
| `src/play/playtestScene.test.js` (new) | small `node --test` of the view-grid construction logic (pure: parsed + player cell + collected-coin cells → grid) |
| `tests/playtest-tileset.spec.js` (new Playwright) | a level that exercises the new path end-to-end: a PWYP playtest screenshots the Pea sprite, not the play-assets player |

### What's intentionally kept unchanged

- `Player.update(dt, scene)` — physics, jump, swept collision.
- `rectsOverlap` — collision/pickup/spike-hit detection.
- The vendored `Player`/`Coin`/`Spike`/`Goal` entity `.draw()`
  methods are kept (in case anything else calls them) but **not
  invoked** by the new `PlaytestScene.draw`. They become legacy code
  paths; cleanup (and play-assets removal) is the v15 candidate.
- AssetLoader's `loadSprite` / `synth` (the coin-pickup sound stays
  Web-Audio synthesised; pickup sound is independent of art).

### What about the canvas size?

The playtest canvas is created at `worldW × worldH` (= `meta.width
* TILE`, `meta.height * TILE`) by the launcher. The editor
renderer's `draw()` resizes the canvas to the same dimensions if not
already — `if (ctx.canvas.width !== w) ctx.canvas.width = w;` — so
the re-size is a no-op per frame, no thrash.

The scale-to-fit CSS on `.playtest canvas` (v9) is unaffected: world
pixels in, scaled to viewport by CSS.

## 6. Open questions — RESOLVED (recommended defaults)

- **Player char isn't always `'P'`** — the legend tells us which
  char maps to `role:player`. Resolved via `legend` lookup at
  draw time: find the first char whose role is `player`. The
  player overlay's sprite uses `tileset.entityFor(thatChar)`. (For
  Dirt and all 4 user packs the char is `P`.)
- **Player position is float, grid is integer** — the player
  overlay draws at `Math.round(player.x), Math.round(player.y)` so
  sprite blits land on pixel-aligned coordinates (avoids
  sub-pixel anti-aliasing while the bean moves).
- **Coins that are mid-collect-frame** — once a coin's `.collected`
  flag is set, that frame's view grid omits its cell; the editor
  renderer skips it. No pop / fade.
- **Animation playback** — still frozen on `frame: 0` (v11 decision
  unchanged). Per-frame animation is a v15+ candidate.
- **State-changing exit** (`imageActive` when all pickups
  collected) — still v15+ candidate. v14 leaves the exit visually
  static.
- **Atlas decor on non-Dirt tilesets** — still Dirt-only (v8 decor
  limit). v14 doesn't change that.

## 7. Acceptance criteria

- A PlayWithYourPeas / Pixel Adventure 1 / Treasure Hunters level,
  when played, shows that tileset's art on the canvas — not the
  kaplay-style sprites. Specifically: a Pea instead of the kaplay
  bean, the Apple/Cherry instead of the kaplay coin, etc.
- Dirt playtest shows the autotiled dirt terrain + decor (grass /
  moon / drips) in the canvas, with the player drawn as the shape
  fallback (blue disc) — matching the editor preview exactly.
- Multi-glyph pickups (a hypothetical level with both `o` and `O`
  pickups) render their own sprites on the playtest canvas, each
  collectable independently and counting toward the win.
- Decorations rendered in playtest are visible but inert (the
  player walks through them, no collision).
- Coin-collection: collecting a coin removes it from the canvas
  immediately on the next frame.
- Player movement, jumping, spike-death, goal-win, R/Esc semantics
  all unchanged from v9.
- Existing playwright distinctness (v10 capture+hash) and splitter
  specs (v12/v13) still green.
- Unit suite stays green; ≥ 2 new pure tests for view-grid
  construction.

## 8. Non-impact (explicit)

- `level.js`, `validate.js`, `tileset.js`, `levels.js`, `history.js`
  — unchanged.
- The level format and all `tile_lookup.json` files — untouched.
- The v12/v13 splitter mechanics — unchanged.
- The playtest's physics, jump, gravity, collision, swept-y
  resolution, win/lose detection — all unchanged. The Player
  entity's `.update()` and the adapter's role mapping stay exactly
  as v11 left them.
- The vendored `simple-platformer-1` code remains in `src/play/`
  byte-identical to upstream@4c3b936 (no further forks beyond the
  four already documented in v9 §7).

## 9. Non-goals + v15+ candidates

- **Animated playback** of multi-frame sprites in the playtest
  (e.g. Mask Dude cycling through his 11 idle frames over time) —
  needs a clock.
- **State-changing exit** (`imageActive` once all pickups collected)
  — small, but not strictly needed for "play what you see".
- **Multi-row tile atlases** (Treasure Hunters palm-terrain 17×5) —
  still v15+; needs a `cols × rows` schema.
- **Procedural-decor data** — lifting Dirt's grass/moon/drips rules
  into the lookup so other packs can author decor procedurally.
- **Cleanup of vendored entity `.draw()` methods + `play-assets/`** —
  unused after v14 but kept in place as a tidy follow-up.
- **Keyboard nudge on splitters** (v14 polish leftover from v12/v13).
