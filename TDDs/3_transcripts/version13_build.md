# Transcript — Version 13: Resizable Problems Panel

A narrative record of the v13 phase: making the horizontal dividing
line between the editor and the problems panel draggable, so the
author can grow the panel when juggling many issues and shrink it
out of the way when there are none. The vertical sibling of v12.

## The brief

User asked, after v12 shipped: "make the message section — bottom
part of screen — resizable, just like the vertical screen divider
you just created". Single feature; obvious symmetric design; the
work was mostly choosing how much of v12's plumbing to share.

## Share, don't fork

Three options for "another splitter":

- (a) Fork `splitter.js` into a parallel `problems-splitter.js`.
  Cheapest cognitive load; most code duplication.
- (b) Generalise `setupSplitter()` to take an axis parameter +
  configurable storage key + configurable CSS variable. Cleanest if
  splitters multiply, but threads a lot of optional config through
  v12's existing callsite for no reduction in the v12 + v13 total
  line count.
- (c) Add a sibling `setupProblemsSplitter()` in the same file. The
  pure helpers (`clampPx`, `loadInitial`, `safeStorage`) are already
  axis-agnostic — they take a `total` length and two `min` values.
  `loadInitial`'s only hardcoded thing is the v12 storage key, which
  becomes an optional parameter.

(c) was the call. Two `setup*` functions; one shared file; one new
optional param. v12's callsite is **byte-untouched**; v12's tests
pass through unchanged.

## The one surprise

Both splitters' clamps had a latent bug: the **6 px bar itself**
takes pixels in the middle, and neither v12's nor my initial v13
clamp accounted for them. With a panel ceiling of `total - MIN_EDITOR`
and a 6 px bar between, the *actual* editor minimum was
`MIN_EDITOR − 6`, not `MIN_EDITOR`. The v12 Playwright test didn't
catch it because it only measured the LEFT pane after a drag (the
clamped side); my v13 Playwright test caught it immediately because
it measures BOTH the panel AND the editor on the extreme drag.

Fix in v13: add a `SPLITTER_H_PX = 6` constant and clamp with
`MIN_EDITOR + SPLITTER_H_PX` so the bar's pixels are reserved on the
"other side" of the drag. v12 has the same latent issue but no
measurable user impact (the right pane can sit at 214 px instead of
220 — three rows of the toolbar still fit). Folding it into v13's
fix would have touched the v12 commit's behaviour without test
coverage to back it; left for a v14 polish pass if needed, with a
note in the design.

## Default = identical to v12

The v13 CSS rule is `height: var(--problems-h, 25vh)`. A fresh user
with no stored value has the variable unset → the `25vh` fallback
applies → layout is byte-identical to v12. Reset (double-click) goes
back to the same state by `removeProperty('--problems-h')` (NOT
re-setting `25vh` as a px value), so a later window resize still
keeps the 25 % ratio.

## Build

- **M1 — layout swap + visible bar (no JS).** `.problems` height
  switched to the CSS variable with `25vh` fallback. Old `border-top`
  removed. New `.splitter-h` rule: 6 px tall, `row-resize` cursor,
  hover + dragging tints symmetric to v12's `.splitter`. DOM insert
  for `#splitterH` between `.editor` and `.problems` in `main.js`.
  Typing `:root{--problems-h: 300px}` in DevTools resized the panel —
  proof the layout swap was correct.

- **M2 — drag handler + persistence + tests.** New
  `setupProblemsSplitter()` mirroring v12 with axis-flipped maths
  (`viewportH − e.clientY` instead of `e.clientX`). `loadInitial`
  gains optional `storageKey` argument (defaults to v12's key, so
  every existing v12 callsite is unchanged). v13 uses `V13_STORAGE_KEY
  = 'ld:v13:problemsH'`. Persistence reads the actual rendered panel
  height (not the clamp-stale clientY). Reset clears storage AND
  removes the CSS property. Unit tests: 124 → 125 (+1 for the
  `loadInitial` custom-key case; existing tests pass unchanged).

- **M3 — Playwright e2e (this milestone).** Four new vertical specs
  mirroring v12's four:
  - drag the bar up by 100 px → panel grows by ≥80 px
  - drag + reload → height preserved within 3 px slack
  - drag + double-click → panel returns to ≈ 25 vh
  - clamp: drag past the bottom → panel ≥ 60 px and ≤ ~80 px;
    drag past the top → editor ≥ 240 px

  Playwright suite 6 → 8 (+2 unique to v13 after applying the bar-
  height clamp fix; the other two passed first time). Wait, all 4
  new specs pass; the clamp test originally failed (editor measured
  234 px instead of ≥ 240), which is what surfaced the latent
  SPLITTER_H clamp bug and led to the fix landed in M2's
  follow-up.

## What stayed out

- **Keyboard nudge** on focused splitters (still v14 polish).
- **Generic splitter abstraction** — wait for a 3rd splitter.
- **Collapse-to-zero** with re-open button — the 60 px min already
  supports "almost hidden".
- **Auto-shrink panel when no problems** — conflicts with the
  user's explicit-drag persistence model.

## The standing gap

Unchanged: no automated DOM-mutation test of the broader interactive
surface beyond Playwright. v13 grew that harness to **8 specs** and
the unit suite to **125 tests**. The shared `splitter.js` is now the
home of both v12 and v13 plumbing — about the right size before a
generic refactor becomes worth it.
