# Version 13 — Implementation Plan

Status: Proposed · Date: 2026-05-20 · Design:
[../1_design/version13_design.md](../1_design/version13_design.md)

A single focused feature: drag the line between `.editor` and
`.problems` to resize the problems panel. Strict sibling of v12 (same
storage shim, same pure helpers, same milestone shape), implemented
as a second `setup*` function in `src/splitter.js`.

## Process (same discipline as v8–v12)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- Pure parts unit-tested under `node --test`; the live drag is
  Playwright-tested.

## Constraints & approach

- **v12 is untouched.** `setupSplitter()` keeps its signature and
  behaviour. v13 adds a sibling `setupProblemsSplitter()`. The pure
  helpers `clampPx` and `loadInitial` already work on either axis;
  `loadInitial` gains an optional `storageKey` argument (default
  preserves v12's key, so existing callers don't change).
- **CSS variable drives layout, no inline element widths.** Drag
  handler sets `document.documentElement.style.setProperty(
  '--problems-h', '<px>px')`.
- **Default = unset.** A fresh user sees `height: 25vh` from the CSS
  fallback — identical to today.

## Module map

| File | Change |
|------|--------|
| `src/style.css` | `.problems { height: var(--problems-h, 25vh); ... border-top removed }`; new `.splitter-h { height: 6px; cursor: row-resize; ... }` (symmetric to `.splitter`) |
| `src/main.js` | insert `<div class="splitter-h" id="splitterH">` between the `.editor` and `.problems` divs; call `setupProblemsSplitter()` next to the existing `setupSplitter()` |
| `src/splitter.js` | add `setupProblemsSplitter({doc, win, storage})`; export the storage key constant for tests; `loadInitial` gains optional `storageKey` |
| `src/splitter.test.js` | one new test for `loadInitial` with an alternate `storageKey`; existing tests pass through unchanged |
| `tests/splitter.spec.js` | 4 new vertical specs mirroring v12: drag widens panel, reload preserves, double-click resets, clamps both ways |

## Milestone 1 — Layout swap + visible horizontal splitter (no JS drag yet)

1. `src/style.css`:
   - `.problems`: replace `height: 25vh` with `height: var(--problems-h, 25vh)`; remove the `border-top` (the new bar replaces it visually).
   - New `.splitter-h` rule: `height: 6px; flex: 0 0 auto; background: var(--line); cursor: row-resize; user-select: none; touch-action: none;` plus hover + `.dragging` tints (`var(--dim)` / `var(--fg)`).
2. `src/main.js`: insert `<div class="splitter-h" id="splitterH" title="Drag to resize · double-click to reset"></div>` between the `.editor` div and the `.problems` div.
3. No JS yet — verify by typing `:root { --problems-h: 300px }` in DevTools and seeing the panel grow. Build clean; Playwright still green.

Commit: `v13 m1: visible horizontal splitter + height-driven problems panel`.

## Milestone 2 — Drag handler + persistence + reset + tests

1. `src/splitter.js`:
   - Export a constant `V13_STORAGE_KEY = 'ld:v13:problemsH'` (kept symmetric to the v12 implicit one).
   - Extend `loadInitial(storage, totalPx, minA, minB, storageKey = 'ld:v12:splitter')` with the optional `storageKey` parameter (default preserves v12 callsites).
   - New `setupProblemsSplitter({doc, win, storage})`:
     - On startup, read storage; if a number is persisted, apply it as `--problems-h: <px>px`. Otherwise **leave the property unset** so the CSS fallback (`25vh`) applies — identical to today's first paint.
     - `pointerdown` on `#splitterH`: setPointerCapture, mark `.dragging`.
     - `pointermove`: `h = clampPx(win.innerHeight - e.clientY, 60, 240, win.innerHeight)`; write `--problems-h`.
     - `pointerup`: read the real `.problems` `getBoundingClientRect().height`, persist as integer string to `V13_STORAGE_KEY`. Defensive try/catch around storage.
     - `dblclick`: `removeItem(V13_STORAGE_KEY)` AND `root.style.removeProperty('--problems-h')` → CSS default reapplies.
   - `safeStorage` already exists from v12; reused.
2. `src/main.js`: `setupProblemsSplitter();` immediately after the existing `setupSplitter();` call.
3. `src/splitter.test.js`: add one case proving the `loadInitial(..., storageKey)` argument reads a different key when supplied.

Commit: `v13 m2: problems panel drag + persistence + reset (tested)`.

## Milestone 3 — Playwright e2e + transcript + Delivered

1. `tests/splitter.spec.js`: 4 new specs mirroring v12:
   - Drag the horizontal splitter up by 100 px → problems panel widens (heightens) by ≥80 px.
   - Drag + reload → preserved within 3 px.
   - Double-click → problems panel returns to ~25 % of the viewport height (within reasonable slack — 25 vh of 800 = 200 px, allow ±15).
   - Drag past clamps → never below 60 px or above viewportH − 240.
2. `TDDs/3_transcripts/version13_build.md`; mark design + impl Delivered.

Commit: `v13 m3: playwright vertical splitter spec + v13 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is structural** but tiny: one CSS rule change, one DOM
  insert, one new CSS rule for the bar. The flex column already
  expected the problems panel to be auto/fixed-height; no
  rebalancing.
- **M2 is the only behavioural change** and reuses every primitive
  v12 already shipped (clampPx, safeStorage, the pointer-capture
  pattern). Risk is mostly "did I get the axis right" — covered by
  the M3 specs.
- **Visible v12 panes are unaffected** — the new bar is below the
  `.editor` row, not within it. The v12 distinctness Playwright is
  unaffected (preview canvas pixels untouched).
- **No deploy risk.** Bundle grows by a few hundred bytes
  (`setupProblemsSplitter` + minor wiring); Pages workflow
  unchanged.

## Deferred (design §9 → v14)

Keyboard nudge on focused splitters (both axes); generic splitter
abstraction (axis parameter) once a third splitter appears;
collapse-to-zero with a re-open button.
