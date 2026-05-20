# 2D Level Designer — Version 13 Design Document

Status: Proposed · Date: 2026-05-20 · Builds on:
[version12_design.md](version12_design.md) (which it directly mirrors,
rotated 90°) · Implementation:
[../2_implementation/version13_implementation.md](../2_implementation/version13_implementation.md)

## 1. Purpose

The **problems panel** at the bottom of the editor is currently fixed
at `25vh`. When the author has many issues, the list fills the panel
and the rest is hidden inside its own scroll; when they have none,
that 25% is wasted vertical space.

v13 makes the dividing line between `.editor` and `.problems`
**draggable** — same pattern as v12's left/right splitter, rotated 90°
— so the author can shrink the panel out of the way when not needed
and grow it when juggling a lot of issues.

A single focused feature, **strict sibling** of v12 (same mental
model, mostly shared code).

## 2. Current state

`src/style.css`:

```css
.problems {
  height: 25vh;          /* hardcoded — the bug v13 fixes */
  overflow: auto;
  ...
}
```

`#app` is a vertical flex column; `.editor` is `flex: 1` (takes the
remainder); `.problems` has the fixed 25vh height. The horizontal
border-top between them is just CSS — no drag affordance.

## 3. UX

- A **visible draggable bar** (~6 px tall) replaces the existing
  border-top between `.editor` and `.problems`. Hover →
  `cursor: row-resize`; the bar tints brighter while hovered and
  while dragging.
- **Min sizes**: 240 px on the editor (textarea + a reasonable
  canvas), 60 px on the problems panel (visible row count + padding).
- **Double-click the bar** → reset to the v0 default (`25vh`,
  viewport-relative — so resizing the window keeps the ratio).
- **Persisted in pixels** under `ld:v13:problemsH` (same rationale as
  v12: keeping the actual row count stable beats keeping a ratio
  fixed).
- **Pointer events** drive the drag — mouse / trackpad / touch alike.
- **No keyboard nudge** in v13 (still deferred — would pair with v12's
  in a single v14 "splitter polish" pass if asked).

## 4. Architecture / impact

| File | Change |
|------|--------|
| `index.html` / `src/main.js` | a new `<div class="splitter-h" id="splitterH">` between the `.editor` and `.problems` divs. |
| `src/style.css` | `.problems` height becomes `var(--problems-h, 25vh)` (default unchanged: `25vh`); `.editor` keeps `flex: 1` (takes the remainder). Existing `border-top` on `.problems` removed (the splitter is the new visible divider). New `.splitter-h` rule symmetric to `.splitter`: 6 px tall, `cursor: row-resize`, full-width. |
| `src/splitter.js` | extend with a `setupProblemsSplitter({...})` export that mirrors `setupSplitter()` but vertically. Pure helpers `clampPx` + `loadInitial` already axis-agnostic; `loadInitial` gains an optional `storageKey` argument (defaulting to the v12 key) so v13 can share it without colliding. |
| `src/splitter.test.js` | extend with `loadInitial(..., storageKey)` cases. |
| `src/main.js` | call `setupProblemsSplitter()` next to the existing `setupSplitter()`. |
| `tests/splitter.spec.js` | extended with 4 vertical specs (drag / persist / reset / clamp), mirroring the horizontal ones. |

### Why two `setup*` functions, not one generic

A single generic `setupSplitter({axis, …})` is appealing but: (1) it
would change the v12 callsite signature for no real reduction in
code; (2) the two splitters differ in more than axis — `clientX` vs
`clientY`, `--left-pct` vs `--problems-h`, **complementary direction**
(left-pane width grows *with* clientX, problems height grows
*against* clientY — `viewportH − clientY`), and the reset string
(`'50%'` vs `'25vh'`). Keeping them as two siblings with a shared
pure-helpers core is clearer than threading an axis parameter
through. v14 could refactor to a single generic if a third splitter
appears.

### Default reset value

v12 resets to `50%`. v13 resets to `25vh` — which matches the
*existing* implicit default. This means a fresh user (no storage)
sees identical layout to today; only a deliberate drag changes it,
and double-click takes them back exactly where they started.

## 5. Persistence

- Key: `ld:v13:problemsH`.
- Value: integer pixel height (e.g. `"180"`).
- Read once at startup; missing → leave `--problems-h` *unset* so the
  CSS fallback (`25vh`) applies, identical to today.
- Reset clears the key AND removes `--problems-h` from
  `documentElement.style` (back to the `25vh` CSS default).
- Same defensive `safeStorage` shim already in `splitter.js` (private
  mode → in-memory Map, session-only).

## 6. Open questions — RESOLVED (recommended defaults)

- **Visible bar vs. invisible border drag** — visible 6 px bar
  (matches v12; discoverability).
- **Min sizes** — 60 px (problems) / 240 px (editor). Smaller-by-
  default on the panel because "almost hidden" is a valid layout
  state when there are no problems.
- **Pixel vs. percent persistence** — pixels (matches v12).
- **Default initial value** — leave `--problems-h` unset; the CSS
  default `25vh` applies (identical to today's render for a fresh
  user).
- **Reset behaviour** — clear storage + `removeProperty(...)`, so a
  later window resize still keeps the ratio (rather than freezing
  the moment-of-reset pixel value).
- **Touch** — covered by pointer events; no separate handler.
- **Keyboard nudge** — deferred (v14 polish, paired with v12's).

## 7. Acceptance criteria

- A visible 6 px horizontal bar appears between the editor and the
  problems panel; hovering shows `row-resize`.
- Vertical drag adjusts the problems panel height live; the editor
  shrinks/grows to fill the remainder.
- Clamps at 60 px on the problems and 240 px on the editor; yanking
  past either stops at the clamp.
- Reload preserves the dragged height (within rounding).
- Double-click resets to `25vh` (and clears storage so subsequent
  window resizes still keep the ratio).
- The existing playtest, level loader, splitter (v12), legend, and
  preview canvas continue to render correctly. v12's preview-hash
  distinctness assertion is unaffected.
- `node --test` and Playwright suites stay green; v13 adds a small
  number of pure tests (loadInitial-with-custom-key) and 4 new
  Playwright specs mirroring v12's drag/persist/reset/clamp set.

## 8. Non-impact (explicit)

- `level.js`, `validate.js`, `tileset.js`, `renderer.js`,
  `levels.js`, `history.js`, anything under `src/play/` — none read
  panel heights.
- The level format and all `tile_lookup.json` files — untouched.
- The v12 horizontal splitter — unchanged. v13 just adds a sibling.

## 9. Non-goals + v14+ candidates

- **Keyboard nudge** on focused splitters (both v12 and v13) —
  small polish pass.
- **Generic splitter abstraction** (one function, axis parameter) —
  worth doing only if a third splitter appears.
- **Hide / show the problems panel** with a button. The 60 px min
  already supports "almost hidden"; a real "0 px collapse" with a
  re-open button is a v14 candidate if asked.
- **Inverse: shrink the panel** to fit content when empty. Possible
  but conflicts with the user's explicit-drag persistence model
  (would the auto-shrink wipe their saved height?). Defer.
