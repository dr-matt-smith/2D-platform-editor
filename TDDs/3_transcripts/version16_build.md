# Transcript — Version 16: Animated Sprite Playback

A narrative record of the v16 phase: making multi-frame sprite sheets
*actually animate* during playtest. v11 froze on `frame: 0`; v16 makes
the frame index a function of time.

## The brief

User asked: "create v16 design for animated playback". v11's design
§13 already listed it as a v15+ candidate (and v11/v14/v15 all carried
it forward in their non-goal lists). The seed was planted four
versions ago; v16 cashed it in.

## The design call that did most of the work

The hardest call wasn't *whether* to animate but *where*. Three
options:

1. **Editor preview animates too.** Most "WYSIWYG" — pressing Play
   shows the same motion you saw in the preview.
2. **Playtest only.** The static preview is for *authoring*; the
   playtest is for *playing*. Authoring with a wiggling bean is
   distracting, and the editor would need an rAF loop while idle.
3. **Both, with a toggle.** Lets the author choose. More UI.

Picked (2). Static-while-authoring keeps the editor cheap on CPU and
keeps the preview deterministic — paint a `#`, see what the cell
looks like, no oscillation under the brush. Playtest is where motion
belongs.

That single decision shaped the implementation: an optional `now`
parameter on the renderer + accessors. Editor omits it → static
frame 0. Playtest passes `performance.now()` → animation.

## The accessor shape that fell out

After v11, accessors returned a static `{image, sx, sy, sw, sh}`
draw spec. v16 needed them to return *different* specs at different
times. The cleanest way: store either a static spec OR a `(now) =>
spec` **pure function**. The accessor checks which and resolves:

```js
const resolve = (entry, now) =>
  entry == null ? null : typeof entry === 'function' ? entry(now) : entry;
```

Pure: no shared mutable state, no side effects. The unit tests hit
the animator with any `now` value — no clock-freezing, no DOM, no
brittleness.

## The §4 truth table

| `frames` | `frame` | `fps` | Result |
|---|---|---|---|
| `1` (default) | — | — | static, whole image |
| `> 1` | **explicit** | — | static at frame i (v11 author override preserved) |
| `> 1` | absent | absent (default 10) | animated at 10 fps |
| `> 1` | absent | `> 0` | animated at that fps |
| `> 1` | absent | `0` | static at frame 0 (explicit opt-out) |

Note the back-compat path: **callers that don't pass `now` resolve
to frame 0**. Animators have `Number.isFinite(now) && now > 0 ? now
: 0` defensiveness, so `entry(undefined)` synthesises the frame-0
spec — identical to v15's static spec for every existing test. The
138 unit tests from v15 all passed unchanged at the end of M1.

## Build

- **M1 — animator + fps + tests.** `buildSpec` extended with the
  truth-table branching. Animator is a pure `(now) => spec` closure
  over `image / frames / fps / sw / sh`. New constant
  `DEFAULT_FPS = 10`. Accessors gain optional `now` and route via a
  shared `resolve(entry, now)` helper. Seven new unit cases hit the
  truth table: default 10-fps cycling; back-compat no-`now`;
  explicit `frame: i` static; `fps: 0` static; custom fps;
  defensive NaN/negative `now` → frame 0; load-time-vs-draw-time
  (the animator must not freeze on its construction value).

- **M2 — renderer + playtest plumbing.** `draw(ctx, parsed, tileset,
  tile, now)` gains the fifth arg and forwards it to all three
  accessor call sites (terrain pass, decoration Pass 4a, entity
  Pass 4b plus its decoration de-dup check). `PlaytestScene.draw`
  captures `performance.now()` *once* per frame and passes it to
  `editorDraw` + the player-overlay `entityFor` lookup. Editor
  preview's `run() → draw(...)` doesn't change — no `now`, no
  animation. Two new renderer test cases prove the carry-through
  (a fake tileset records the `now` it was called with and asserts
  it matches `12345` across all accessors; and that omitting `now`
  passes `undefined`).

- **M3 — Playwright animation smoke (this milestone).**
  `tests/playtest-animation.spec.js`: switch to Pixel Adventure 1,
  wait for the v14 `window.__activeTileset` flag + a PA1-specific
  legend signal ("Mask Dude" text), launch playtest, screenshot,
  wait 400 ms (~4 frames at default 10 fps), screenshot again,
  assert md5s differ. The assertion is honest about its
  hybrid-nature: in 400 ms both the animator and the player's
  gravity have moved — combined with M1's deterministic per-frame
  `sx` assertions, the total proof is sufficient.

## Visible result

| Tileset | What changed in v16 playtest |
|---|---|
| **Pixel Adventure 1** | Mask Dude cycles his 11 idle frames at 10 fps; Apple cycles its 17 frames at 10 fps. Checkpoint, Spikes, Crate were already single-frame → unchanged. |
| Dirt / PlayWithYourPeas / Treasure Hunters / 2D Circle Graphic | All `frames = 1` throughout → visually unchanged. |

**Zero `tile_lookup.json` edits.** Pixel Adventure 1 already declared
`frames: 11` (Mask Dude) and `frames: 17` (Apple) since v11 M4 — the
v16 default `fps: 10` simply takes over from there.

## What stayed out

Standing v17+ candidates carried forward:

- **Per-cell phase offset** — would make a row of identical apples
  feel less mechanically-synchronised.
- **Pause-aware animation** (game-time accumulator that freezes
  during the win/lose banner). Pairs with a real pause feature.
- **Multi-row tile atlases** (Treasure Hunters palm-terrain 17×5).
- **Editor-preview animation** behind an opt-in toggle. Not needed
  yet; if authoring habits push for it, easy to add — the renderer
  already has the `now` arg.
- **State-changing exit** (`imageActive` when all pickups in) —
  long-standing candidate from v11/v14/v15.
- **Keyboard nudge** on the v12/v13 splitters.

## The standing gap

Unchanged from v13/v14/v15 — no automated DOM-mutation test of the
broader interactive surface beyond Playwright. v16 grew the e2e
suite from 11 to 12 specs and the unit suite from 131 to 140 tests.
The split that's worked since v11 — deterministic frame-level
assertions in unit tests, real-browser dynamism smoke in e2e —
continues to do its job.
