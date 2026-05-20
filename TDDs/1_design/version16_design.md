# 2D Level Designer — Version 16 Design Document

Status: Proposed · Date: 2026-05-21 · Builds on:
[version11_design.md](version11_design.md) §13 (sprite-frame cropping
was frozen on `frame: 0`; per-frame animation explicitly deferred to a
later version) and [version14_design.md](version14_design.md) (which
made the editor renderer the single source of pixel truth for both
preview and playtest) · Implementation: *to follow once this scope is
approved*.

## 1. Purpose

v11 made each `glyphs.<role>` entry able to declare `frames: N` so a
horizontal-strip sprite sheet renders one frame instead of a squashed
strip. v14 made the editor renderer the single source of pixel truth
for the playtest canvas. v16 closes the obvious follow-up: the frames
cycle **over time** during playtest, so Pixel Adventure 1's Mask Dude
walks his idle loop, the Apple slowly rotates, and any future multi-
frame glyph in any tileset animates with zero authoring beyond the
existing `frames: N` count.

A single focused feature: opt-in via schema, behaviour change confined
to playtest, editor preview unchanged.

## 2. Current state

`src/tileset.js` (post-v15) builds **static** draw specs at load time
for every glyph image:

```js
function buildSpec(image, framesField = 1, frameField = 0) {
  const frames = Math.max(1, Math.floor(framesField ?? 1));
  if (frames === 1) return { image, sx: 0, sy: 0, sw: image.width, sh: image.height };
  const sw = Math.floor(image.width / frames);
  const sh = image.height;
  const safeFrame = ...;     // clamped to [0, frames-1]
  return { image, sx: safeFrame * sw, sy: 0, sw, sh };
}
```

Pixel Adventure 1 declares `frames: 11` (Mask Dude) and `frames: 17`
(Apple). v15 freezes both on `frame: 0`. The playtest shows a still
character + still apples; the natural follow-up is to advance the
frame index over time.

## 3. Where animation runs

Playtest **yes**, editor preview **no**.

- The playtest already runs an unbounded `requestAnimationFrame` loop
  (vendored `Game.start()`); per-frame animation is essentially free
  on top.
- The editor preview only re-renders on buffer change / window resize.
  Adding an rAF loop just to cycle frames in the *static authoring
  preview* would burn CPU + battery for no authoring value, and
  arguably hurt authoring (a wiggling player while you're trying to
  paint terrain). The author can press Play to see motion.

The same renderer (`src/renderer.js` `draw(...)`) drives both views.
Animation is therefore controlled by whether the caller passes a
`now` argument — playtest does, editor doesn't.

## 4. Schema additions (additive, back-compat)

A single optional field per glyph:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `fps` | integer ≥ 0 | `10` (when `frames > 1` and `frame` is not set); ignored otherwise | playback rate in frames per second |

Combined with the existing v11 fields:

| `frames` | `frame` | `fps` | Result |
|---|---|---|---|
| `1` (or absent) | — | — | static; the whole image at TILE size |
| `> 1` | **explicit** | — | static, frozen on that frame (v11 behaviour preserved — author override) |
| `> 1` | absent | absent (default 10) | **animated** at 10 fps |
| `> 1` | absent | explicit `> 0` | **animated** at that fps |
| `> 1` | absent | `0` | static, frozen on frame 0 (explicit "stop") |

**Note** on backwards compatibility: Pixel Adventure 1 already declares
`frames: 11` (Mask Dude) and `frames: 17` (Apple) without `frame` —
which means after v16 ships, **Pixel Adventure 1's playtest sprites
will animate automatically**, with no JSON change. That's by design —
the v11 freeze-on-frame-0 was always an interim. The opt-out for any
author who *prefers* the freeze is `fps: 0` (or pinning with `frame: 0`
explicitly).

The editor preview always sees frame 0 regardless of `fps` (the
renderer is called without `now` from the editor, see §5).

## 5. Renderer + accessor contract (the only behavioural change)

`src/renderer.js` `draw(ctx, parsed, tileset, tile, now)` gains an
optional fifth argument. Pure default: when `now` is omitted, the
renderer renders the static **frame 0** view (identical to v15).

The tileset accessors gain the same optional argument:

```js
tileset.terrainFor(mask, now) → spec | null
tileset.entityFor(char, now)  → spec | null
tileset.decorationFor(char, now) → spec | null
```

Per-glyph internally, an animated entry is stored as a **function of
`now`** that synthesises the spec on the fly; a static entry is stored
as a pre-computed spec object. The accessor calls the function (with
`now ?? 0`) if it has one, otherwise returns the static spec.

Why functions and not objects with mutable `sx`?  Pure: no shared
state, no thread-safety hand-wringing, trivially testable
(`animator(now) → spec` — same input, same output, observable from
unit tests without a DOM).

### Playtest wiring

`src/play/playtestScene.js` `draw(ctx)` already runs every frame
(60 Hz via `requestAnimationFrame`). v16 changes one line:

```js
editorDraw(ctx, viewParsed, this.tileset, TILE, performance.now());
```

…and the player-overlay lookup:

```js
const spec = this.tileset?.entityFor?.(this.playerChar, performance.now());
```

That's the whole behavioural delta. **Editor preview** (`src/main.js`
`run()` → `draw(ctx, parsed, tileset, TILE_PREVIEW)`) is **not
modified** — it omits `now`, accessors return frame 0, the preview
remains static.

### Why pass `now` from the call site, not read it inside the renderer?

Two reasons:

1. **Determinism for tests.** Pure tests of `draw()` and the
   accessors can pass any fixed `now`; the renderer doesn't reach
   for `performance.now()` itself, so unit tests don't need to
   freeze the clock.
2. **Per-render policy.** The same render function powers both
   preview (static) and playtest (animated). Passing `now` lets the
   caller declare intent rather than the renderer guessing.

## 6. Architecture / impact

| File | Change |
|------|--------|
| `src/tileset.js` | `buildSpec` extended to return a function when animated; new exported `STATIC_SPEC_FOR_TESTS = …` shape unchanged; accessors `terrainFor` / `entityFor` / `decorationFor` accept optional `now` and call the function entry if any |
| `src/tileset.test.js` | new cases for the animation rules (per §4 truth table); existing tests pass through unchanged because `entityFor(char)` without `now` still resolves to frame 0 |
| `src/renderer.js` | `draw(...)` accepts optional `now`, forwards to accessors; existing renderer tests pass through unchanged (they call without `now`) |
| `src/renderer.test.js` | one new case asserting a frames-and-fps tileset emits a different `sx` at two different `now` values |
| `src/play/playtestScene.js` | passes `performance.now()` to `editorDraw` and to the player-overlay `entityFor` lookup |
| `tests/playtest-tileset.spec.js` (existing) | unchanged — its assertion (Dirt ≠ PWYP) survives any per-frame timing |
| `tests/playtest-animation.spec.js` (new) | open Pixel Adventure 1's playtest, screenshot at frame 0, drive the rAF loop forwards, screenshot again, assert the two hashes differ — proves the sprite actually animates over time |
| All `tile_lookup.json` files | **unchanged** — `frames: N` without `frame` and without `fps` already animates with v16 defaults |

## 7. Time source

`performance.now()` (high-resolution monotonic clock) is the playtest's
animation clock. It does NOT pause when the playtest's "phase" is
`won`/`dead`/etc. — animations keep cycling under the win/lose banner.
For a v17 "pause" mode that freezes everything (including animation),
a phase-aware game-time accumulator could be passed instead. v16 keeps
it simple.

## 8. Per-cell phase offset (deferred)

Two apples in adjacent cells will animate in **perfect lockstep** with
v16 — same frame at the same time. A hash-of-cell-coords phase offset
(so cells animate slightly out of sync, like grass swaying) is the
natural next polish, but it adds an offset parameter to every accessor
call and a per-cell concept the renderer doesn't currently carry.
Defer to v17.

## 9. Open questions — RESOLVED (recommended defaults)

- **Default fps when `frames > 1` and no fps declared?** — **10 fps**.
  Idle-loop reading. Authors who want faster set `fps: 12` (or
  whatever). Authors who want slower set `fps: 6`. Authors who want
  the v15-style still set `fps: 0` (or `frame: 0` explicitly).
- **Time source** — **`performance.now()`**. No accumulator, no
  pause-aware behaviour in v16.
- **Editor preview animates?** — **No**. Static frame 0 always.
  Animation only when `now` is passed.
- **Per-cell phase offset?** — Deferred to v17 (§8).
- **Animation in the legend (the small thumbnails)?** — **No**. The
  legend already shows frame 0 (or the explicit `frame: i`) and that
  reading is correct for an authoring picker.
- **Could `terrainFor` animate too?** — Schema-wise yes (`frames` is
  on glyph entries, including `glyphs.filled`), but no shipped
  tileset has multi-frame `#`-terrain art, so this is a future-proof
  no-op. The accessor takes `now` for symmetry; pure.

## 10. Acceptance criteria

- Pixel Adventure 1 playtest: Mask Dude cycles through his 11 idle
  frames; the apple sheet cycles through its 17. Visible motion.
- Pixel Adventure 1 editor preview: still shows frame 0 only (static,
  matching v15).
- Dirt / PWYP / TH / 2D Circle Graphic playtests: visually
  byte-identical to v15 (their `frames` is 1 throughout).
- A glyph with `frame: i` explicitly set still renders that frame in
  both preview and playtest (v11 author-override behaviour preserved).
- A glyph with `fps: 0` renders frame 0 in playtest (the opt-out).
- `npm test` green; `npm run test:e2e` green (11 → 12 specs:
  `playtest-animation.spec.js` added); both builds clean.
- Live URL stable.

## 11. Non-impact (explicit)

- `level.js`, `validate.js`, `levels.js`, `history.js`, `splitter.js`,
  `adapter.js`, `playtestGate.js` — unchanged.
- The level format and every shipped `tile_lookup.json` file —
  unchanged (existing `frames: N` declarations animate automatically;
  no migration).
- The v9 §7 byte-identical invariant for vendored `src/play/*` is
  preserved (the only v16 change in that tree is one line of
  `playtestScene.js`, which is v9-original glue, not vendored).
- The Web-Audio coin pickup sound — unchanged.

## 12. Non-goals + v17+ candidates

- **Per-cell phase offset** (§8) — would make groups of identical
  glyphs feel less mechanical.
- **Pause-aware animation** (game-time accumulator that freezes during
  win/lose banners). Probably belongs alongside a real pause feature.
- **Vertical / multi-row atlases** (Treasure Hunters palm-terrain
  17×5) — still v17+. Animation is on the v16 horizontal-strip
  contract; a multi-row schema would extend `frames` to
  `frames: { cols, rows }`.
- **Editor-preview animation** with an explicit "Animate preview"
  toggle button. Not part of v16; can be added if authoring habits
  argue for it.
- **State-changing exit** (`imageActive` when all pickups in) —
  carry-over candidate from v11/v14/v15.
- **Keyboard nudge** on the v12/v13 splitters — carry-over polish.
