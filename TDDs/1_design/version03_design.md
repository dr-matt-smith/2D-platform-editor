# 2D Level Designer — Version 3 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version02_design.md](version02_design.md)

## 1. Purpose

Two related housekeeping/UX changes:

1. **Consolidate game data** — levels, tilesets, and (future) audio currently
   live in two unrelated places (`levels/` at root, tilesets under `public/`).
   Move all of it under one top-level `data/` folder.
2. **Level loader dialog** — the editor can only ever hold one buffer (seeded
   sample or last localStorage draft). Add a menu/dialog to browse the bundled
   levels and switch which one is being edited, guarded by an unsaved-changes
   popup.

No changes to the level format, validation rules, autotiling, or theming.

## 2. Scope

### In scope

- New top-level `data/{levels,tilesets,audio}/` layout; remove `public/`.
- Asset resolution updated so the tileset still loads and levels are
  enumerable by the app.
- A levels manager module + a loader dialog with current/modified indicators.
- Switch flow with an unsaved-changes confirmation (Save draft / Discard /
  Cancel) and a best-effort `beforeunload` guard.
- Per-level draft persistence in `localStorage`; one-time migration of the
  existing single `leveldesigner:v1` key.

### Out of scope

- Writing back to `data/levels/*.txt` from the browser — a static web app
  cannot. "Save" means *persist a draft to localStorage*; exporting/downloading
  a `.txt` or File System Access API write-back is a v4 candidate (§8).
- Creating / renaming / deleting levels from the dialog (v4).
- Audio loading/playback — v3 only creates the placeholder `data/audio/`
  directory; no format or code until assets exist.

## 3. Folder layout

Before → after:

```
public/assets/tilesets/Dirt_Platformer_Tiles/{platformertiles.png,
    tiles/, tiles.json, screenshots/, sources.txt}
levels/{above_ground.txt, below_ground.txt, README.md}
```
```
data/
  levels/    above_ground.txt  below_ground.txt  README.md
  tilesets/  Dirt_Platformer_Tiles/{platformertiles.png, tiles/,
             tiles.json, screenshots/, sources.txt}
  audio/     .gitkeep            (placeholder; future)
src/                              (unchanged location)
(public/ deleted)
```

The slicing pipeline's output path and the `levels/README.md` move with the
data; the script and all doc cross-references update accordingly.

## 4. Asset resolution (the load-bearing decision)

Vite only statically serves its `publicDir` (default `public/`). A *true*
top-level `data/` that is also web-served needs one of:

- **A. `import.meta.glob` (recommended).** No `publicDir`. Levels enumerated
  with `import.meta.glob('/data/levels/*.txt', { query: '?raw', eager: true })`
  → a path→text map, no manual manifest, works in dev and build. The tileset
  PNG becomes a build-resolved asset import (URL emitted by Vite) instead of a
  hard-coded `/assets/...` string. Truly top-level `data/`, idiomatic, but
  touches `tileset.js`'s `ATLAS.src`.
- **B. `publicDir: 'data'` + manifests.** Vite serves `data/` at `/`; tileset
  loads from `/tilesets/...` (URL swap only). The loader needs a generated
  `data/levels/manifest.json` (same pattern as `tiles.json`) because
  public-dir files are not module-enumerable. Simpler mental model, but adds a
  manifest to keep in sync.

**Recommendation: A.** It removes the only hard-coded asset path, needs no
manifest, and keeps the renderer pure. Decision flagged for sign-off in §7.

## 5. Level identity, drafts, and the dirty model

- **id** = filename stem (`above_ground`). The parsed `# name:` is shown as
  the human label; ids are unique (filenames are), names may not be.
- **baseline** = the text last *loaded* into the buffer (bundled original, or
  a restored draft). **dirty** = `currentValue !== baseline`.
- **localStorage scheme** (namespace bumped to avoid clashing with v1/v2):
  - `ld:v3:draft:<id>` — a saved draft for a level.
  - `ld:v3:lastOpen` — id to restore on startup.
  - One-time migration: if legacy `leveldesigner:v1` exists, import it as the
    draft of the default level, then remove the old key.
- Bundled `data/levels/*.txt` are **read-only originals**. "Save" writes
  `ld:v3:draft:<id>` and resets baseline (clears dirty). "Revert to original"
  reloads the bundled text and deletes the draft.

## 6. UX — loader dialog

- **Trigger:** a "Levels" button in the status bar (and `Ctrl/Cmd+O`).
- **Dialog:** modal list of bundled levels; each row shows the label
  (`# name:`), id, a "● modified" marker when a draft exists, and highlights
  the current one. Esc / backdrop click closes (treated as Cancel).
- **Switch flow:**
  - buffer clean → load selected immediately, re-run the pipeline.
  - buffer dirty → confirm popup: **Save draft & switch** /
    **Discard & switch** / **Cancel**. Cancel returns to the dialog with no
    state change.
- **Unload guard:** when dirty, a `beforeunload` handler prompts (best-effort;
  browsers show a generic message — acceptable).
- **Startup:** restore `ld:v3:lastOpen` (its draft if present, else the
  original); if none, load the first bundled level.

## 7. Architecture / modules

- **New `src/levels.js`** — enumerate bundled levels (glob), and manage
  draft/baseline/dirty/lastOpen. Side effects isolated to an injectable
  `storage` (defaults to `localStorage`) so it is unit-testable headless.
- **New `src/loaderDialog.js`** — builds the modal DOM and emits
  `select(id)` / `cancel`; no knowledge of storage or parsing.
- **`src/main.js`** — replaces the single `STORAGE_KEY` block with `levels.js`;
  adds the trigger button, dirty tracking on `input`, and the confirm popup.
- **Unchanged:** `level.js`, `validate.js`, `renderer.js` stay pure and
  untouched. `tileset.js` changes only its atlas-URL source (per §4-A).

## 8. Milestones

| # | Deliverable |
|---|-------------|
| 1 | Move files to `data/`; asset resolution per §4-A; build/tests green; slicing script + doc paths updated |
| 2 | `levels.js` (glob + draft/baseline/dirty, injectable storage) + unit tests; legacy-key migration |
| 3 | `loaderDialog.js` + trigger button; clean-buffer switch flow |
| 4 | Unsaved-changes confirm popup + `beforeunload` guard |
| 5 | Docs/paths swept (v1/v2 design refs, `data/levels/README.md`, §3 asset paths) |

## 9. Open questions

- **§4 mechanism** — confirm A (`import.meta.glob`, recommended) vs B
  (`publicDir: data` + manifest) before milestone 1; it shapes `tileset.js`
  and the loader.
- **Save semantics** — localStorage-only draft is accepted for v3. Is a
  "Download .txt" action wanted in v3, or deferred to v4 with FSAA write-back?
- **Migration** — keep importing the legacy `leveldesigner:v1` draft, or drop
  it (the sample is reproducible)? Recommend import-once for safety.
- **Reachability** — still no lint (carried from v2 §6); newly browsable
  example levels make a bad level more visible. Promote to v3 or hold?

## 10. Acceptance criteria

- No `public/` directory; all game data under top-level
  `data/{levels,tilesets,audio}`; `npm run dev` and `npm run build` work;
  the tileset renders unchanged; `npm test` green.
- The loader lists every bundled level with current/modified indicators.
- Clean buffer → selecting a level switches and re-renders immediately.
- Dirty buffer → switching or unloading prompts; Cancel preserves state,
  Discard reverts to baseline, Save persists `ld:v3:draft:<id>` and clears
  dirty.
- Restarting restores the last-open level and its draft when present; the
  legacy v1 key is migrated once and removed.

## 11. v4 candidates

Export/Download `.txt`; File System Access API write-back to
`data/levels/`; create/rename/delete levels from the dialog; audio assets +
loading; reachability lint if not pulled into v3.
