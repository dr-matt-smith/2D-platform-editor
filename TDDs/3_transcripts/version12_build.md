# Transcript — Version 12: Movable Pane Splitter

A narrative record of the v12 phase: making the vertical dividing line
between the text pane (left) and the canvas pane (right) draggable, so
the author can give whichever side they're working on more screen
real-estate. One focused feature. Decisions and rationale, in order.

## The brief

The user wrote it as a one-line TODO from their `__temp/wish_list.md`:
"make the vertical dividing line moveable, between text version of
level on left side of screen, and interactive graphical editor on
right side of screen — so user can change relative widths of the 2
sides of the screen". The shape of the problem was clear; the design
work was mostly in choosing sensible defaults for the half-dozen UX
sub-decisions that hang off it.

## The locked defaults

Six small choices, resolved with my recommendations and approved as
part of the v12 design (§6 of the design doc):

- A **visible 6 px bar** rather than an invisible drag-on-border —
  discoverability beats minimalism for a feature most users won't
  notice until they try to drag it.
- **220 px min on each side** so neither pane can vanish. The
  textarea wants at least ~one column of grid; the canvas pane wants
  at least its toolbar + a small legend.
- **Pixel persistence**, not percentage. Window resizes after the
  fact then keep the *text column count* stable rather than the
  ratio — which is the property authors actually notice.
- **Double-click to reset** to 50/50; minimal UX, no extra button.
- **Pointer events** for everything (mouse, trackpad, touch
  uniformly). No `mousedown`/`touchstart` plumbing needed.
- **Keyboard nudge** (Left/Right ± 8 px on a focused splitter)
  *deferred* to v13.

## The architectural seed

The whole feature pivots on **a single CSS custom property on
`document.documentElement`**: `--left-pct`. The left pane's width
reads from it; the right pane takes the remainder via `flex: 1`.
That means JS never assigns inline widths to elements during a drag;
it just `setProperty('--left-pct', '<px>px')` on the root once per
`pointermove` event. The browser does the layout. No layout-thrashing
intermediate JavaScript.

This kept the v12 JS surface tiny: two pure helpers (`clampPx`,
`loadInitial`) that exist purely to make `node --test` happy, plus a
`setupSplitter()` that wires four DOM event listeners and reads one
storage key.

## Build

- **M1 — Layout swap + visible splitter (no JS drag yet).** Replaced
  `.pane { flex: 1 }` with `.pane.left { width: var(--left-pct, 50%);
  min-width: 220px }` and `.pane.right { flex: 1; min-width: 220px }`;
  removed the old `border-right` on `.pane.left` (the splitter
  element replaces it visually); added the `.splitter` CSS (6 px,
  `col-resize` cursor, `var(--line)` background; brighter on hover and
  while dragging). Inserted `<div class="splitter" id="splitter">`
  between the two panes in `main.js`'s template. Even with no JS,
  typing `:root{--left-pct: 30%}` in DevTools moved the divider —
  proof the layout swap was wired correctly. **No unit-test churn;
  Playwright e2e (capture + distinctness) still green.**

  One small honesty correction at this milestone: the design doc had
  predicted that preview canvas md5s would stay byte-identical after
  M1. They drifted — the canvas now sits 6 px further right on
  screen, and the compositor anti-aliases the canvas-px-to-screen-px
  mapping at a different sub-pixel offset. Visually the renders are
  identical (verified by reading a pane shot), but the hash drift was
  unavoidable. The Playwright distinctness assertion is unaffected:
  each tileset still hashes uniquely, just at new values.

- **M2 — Drag handler + persistence + reset (tested).** New
  `src/splitter.js` with pure `clampPx(px, minLeft, minRight,
  viewportW)` and `loadInitial(storage, viewportW, ...)` exports,
  both unit-tested headless. `setupSplitter({doc, win, storage})`
  wires `pointerdown → pointermove → pointerup → pointercancel →
  dblclick` on `#splitter`. `pointermove` clamps `e.clientX` and
  writes `--left-pct` in px; `pointerup` reads the actual computed
  left-pane width (so a clamp-stale move isn't persisted) and writes
  it to `ld:v12:splitter`; `dblclick` removes the key and sets
  `--left-pct` back to the literal string `"50%"` (so a window
  resize *after* reset still keeps the panes balanced rather than
  freezing the moment-of-reset pixel width).

  The storage shim mirrors the `levels.js` pattern: a private-mode
  failure falls back to an in-memory `Map`, so the drag still works
  for the session — it just doesn't persist. **11 new `node --test`
  cases** (113 → 124): in-range, below-floor, above-ceiling,
  too-narrow viewport, non-finite inputs; storage hit / miss / junk /
  throw / null.

- **M3 — Playwright e2e (this milestone).** A new
  `tests/splitter.spec.js` proves the real-browser behaviour
  end-to-end:
  - Drag the splitter +120 px → left pane widens by ≥100 px.
  - Drag, reload page → left pane width preserved within ≤3 px slack.
  - Drag, double-click → left pane returns to ~half the viewport.
  - Drag past the right clamp → left pane stops at
    `viewport - 220 px`. Drag past the left clamp → stops at `220 px`.

  Pointer drag via `page.mouse.move/down/up` (Playwright synthesises
  both `mouse*` and `pointer*` events, so the splitter's
  `pointerdown/move/up` handlers fire as expected). **Playwright
  suite 2 → 6 tests, all green.** Combined with the unit suite the
  v12 net delta is +15 tests (113 → 124 unit + 4 new e2e).

## What stayed out (the explicit non-goals)

- **Keyboard nudge** on a focused splitter (Left/Right ± 8 px;
  Home → centre). Small polish; v13.
- **Vertical splitting of the right pane** (canvas above, problems
  panel below, separately movable). Useful but a different feature.
- **Per-level splitter width** — overkill. One global value
  suffices.
- **A "collapse" button** — the 220 px min would prevent a true
  collapse anyway; if it becomes a real ask, v13 can lower the min
  with a button to "fully hide" one pane.
- **A second splitter** inside the right pane (canvas vs. legend or
  canvas vs. problems). Out of v12.

## The standing gap

Unchanged from v11: no automated DOM-mutation test for the editor's
broader interactive surface beyond the Playwright harness. v12 grew
that harness from 2 tests to 6, and added 11 unit tests for the pure
helpers. The pattern that's settling — pure helpers under
`node --test`, real-browser flows under Playwright — held up cleanly
for this version.
