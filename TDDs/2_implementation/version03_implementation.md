# Version 3 — Implementation Plan

Status: Planned (design is Draft) · Date: 2026-05-18 · Design:
[../1_design/version03_design.md](../1_design/version03_design.md)

A forward plan: v3 is not yet built. One milestone per commit, prefixed
`v3 …`, design/docs updated in the same commit, `npm test` green and
`npm run build` clean before each.

## Constraints & approach

- Keep `level.js`, `validate.js`, `renderer.js` pure and untouched.
  `tileset.js` changes one URL string only.
- New stateful logic (`levels.js`) takes injected `fetch` + `storage` so it is
  unit-tested headless with `node:test`, consistent with v1/v2.
- The manifest generator is **Node** (no Python/PIL), so the
  `predev`/`prebuild` hooks run anywhere Node runs.
- Static app: no disk write-back. "Save" = localStorage draft; the only real
  file out is the `.txt` download (Blob + `<a download>`).

## Module map

| File | Status | Pure? |
|------|--------|-------|
| `scripts/gen-levels-manifest.mjs` | new (build tooling) | n/a |
| `src/levels.js` | new — manifest/fetch + draft/baseline/dirty | yes (deps injected) |
| `src/loaderDialog.js` | new — modal DOM, emits select/download/cancel | no (DOM) |
| `src/download.js` | new — buffer → `<id>.txt` Blob download | no (DOM) |
| `src/main.js` | changed — wire levels.js, dialog, dirty, popup | no |
| `src/tileset.js` | changed — atlas URL `/assets/…` → `/data/…` | no |
| `package.json` | changed — `predev`/`prebuild` hooks | n/a |

## Milestone 1 — Data move + manifest hook

The riskiest step (bulk move + the only runtime-affecting code change); do it
atomically and smoke-test before anything else builds on it.

1. `git mv` `levels/` → `public/data/levels/`,
   `public/assets/tilesets/` → `public/data/tilesets/`; add
   `public/data/audio/.gitkeep`. Remove the now-empty `public/assets/`.
2. `src/tileset.js`: `ATLAS.src` →
   `/data/tilesets/Dirt_Platformer_Tiles/platformertiles.png`.
3. `scripts/gen-levels-manifest.mjs`: scan `public/data/levels/*.txt`, parse
   the `# name:` directive (reuse `level.js`'s regex shape), write
   `public/data/levels/manifest.json` = `[{ id, name, file }]` sorted by id.
4. `package.json`: `"predev": "node scripts/gen-levels-manifest.mjs"`,
   `"prebuild": "node scripts/gen-levels-manifest.mjs"` (npm runs `pre<script>`
   automatically). `manifest.json` is git-tracked but regenerated, so commit
   the generated file and let the hook keep it fresh.
5. Update the slicing-script output path note and `data/levels/README.md`.
6. **Verify:** `npm test` green (renderer tests use a null tileset, so the
   path swap can't regress them); `npm run build` clean; dev smoke —
   `curl` `/data/tilesets/.../platformertiles.png` and
   `/data/levels/manifest.json` both `200`.

Commit: `v3 m1: consolidate game data under public/data + manifest hook`.

## Milestone 2 — `levels.js` + migration

1. `createLevels({ fetch, storage })` exposing:
   - `list()` → manifest entries (+ `modified` flag if `ld:v3:draft:<id>`).
   - `load(id)` → text (draft if present else fetched original); sets baseline.
   - `save(id, text)` → write `ld:v3:draft:<id>`, reset baseline.
   - `revert(id)` → delete draft, re-fetch original.
   - `isDirty(text)` → `text !== baseline`.
   - `lastOpen()` / `setLastOpen(id)` via `ld:v3:lastOpen`.
2. **Migration (once):** if `localStorage['leveldesigner:v1']` exists, write it
   as `ld:v3:draft:<defaultId>`, set `lastOpen`, delete the old key. Guard with
   a `ld:v3:migrated` flag so it runs exactly once.
3. Tests (`src/levels.test.js`): fake `storage` (Map-backed) + fake `fetch`
   (manifest + text). Cover draft-over-original precedence, dirty transitions,
   revert, and the one-shot migration.

Commit: `v3 m2: levels manager + legacy key migration (tested)`.

## Milestone 3 — Loader dialog + clean switch

1. `loaderDialog.js`: build modal from `levels.list()`; rows show label
   (`# name:`), id, `● modified`, current highlight; emits
   `select(id)` / `download(id)` / `cancel`. Esc/backdrop = cancel.
2. `main.js`: add a "Levels" status-bar button + `Ctrl/Cmd+O`; on `select`
   with a **clean** buffer → `levels.load`, set textarea, `setLastOpen`,
   re-run the pipeline.
3. Startup: replace the `STORAGE_KEY` block — restore `lastOpen` (draft or
   original), else first manifest entry.

Commit: `v3 m3: level loader dialog + clean-buffer switching`.

## Milestone 4 — Unsaved-changes guard

1. Track dirty on textarea `input` (`levels.isDirty(value)`); reflect it in
   the status bar and dialog rows.
2. On `select` with a **dirty** buffer → confirm popup: **Save draft &
   switch** (`levels.save` then load) / **Discard & switch** (load, drop
   working changes) / **Cancel** (return to dialog, no change).
3. `beforeunload`: when dirty, `e.preventDefault()` (best-effort generic
   prompt — documented limitation).

Commit: `v3 m4: unsaved-changes popup + beforeunload guard`.

## Milestone 5 — Download `.txt`

1. `download.js`: `downloadText(id, text)` → `Blob(['…'],{type:'text/plain'})`
   → object URL → `<a download="<id>.txt">` → click → revoke.
2. Wire to dialog per-row + a current-buffer button in the status bar.
3. Test the pure part: a `toLevelFile(id, text)` helper (name/extension +
   trailing-newline policy) unit-tested so `parse(download)` round-trips;
   the DOM click path is verified by dev smoke, not unit-tested.

Commit: `v3 m5: download current level as .txt`.

## Milestone 6 — Docs/paths sweep

Update `version01/02/03` design refs, both implementation docs, the v2
transcript's path mentions, `levels/README.md` (now under `public/data/`), and
design §3 paths. Add a v03 transcript entry consistent with v01/v02.

Commit: `v3 m6: docs + path sweep`.

## Risks & sequencing

- **M1 is load-bearing.** Everything else assumes `/data/...` resolves; do not
  start M2 until the M1 dev smoke passes.
- **Manifest staleness** is designed out by the hook, but `npm test` does *not*
  run it; that is fine because `levels.test.js` injects its own manifest.
- **Migration** must be idempotent — the `ld:v3:migrated` flag is mandatory,
  not optional.
- **DOM-heavy modules** (`loaderDialog`, `download`) keep logic in pure
  helpers so coverage stays meaningful without a browser test harness.

## Deferred decisions (design §9)

- Keep importing the legacy `leveldesigner:v1` draft (recommended) vs. drop.
- Reachability lint: hold for v4 unless promoted before M2.
