# 2D Level Designer — Version 3 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version02_design.md](version02_design.md)

## 1. Purpose

Two related housekeeping/UX changes:

1. **Consolidate game data** — levels, tilesets, and (future) audio currently
   live in two unrelated places (`levels/` at root, tilesets under
   `public/assets/`). Move all of it under a single `public/data/` folder.
2. **Level loader dialog** — the editor can only ever hold one buffer (seeded
   sample or last localStorage draft). Add a menu/dialog to browse the bundled
   levels and switch which one is being edited, guarded by an unsaved-changes
   popup, plus a "Download .txt" action.

No changes to the level format, validation rules, autotiling, or theming.

## 2. Scope

### In scope

- New `public/data/{levels,tilesets,audio}/` layout; old `levels/` and
  `public/assets/` removed.
- `tileset.js` atlas path swapped to the new location; a generated
  `public/data/levels/manifest.json` so the app can enumerate levels.
- A levels manager module + a loader dialog with current/modified indicators.
- Switch flow with an unsaved-changes confirmation (Save draft / Discard /
  Cancel) and a best-effort `beforeunload` guard.
- Per-level draft persistence in `localStorage`; one-time migration of the
  existing single `leveldesigner:v1` key.
- **Download `.txt`** — export the current buffer as a level file the user
  can drop into `public/data/levels/` themselves.

### Out of scope

- Programmatic write-back to `public/data/levels/*.txt` (File System Access
  API or a dev-server endpoint) — v4 candidate (§11).
- Creating / renaming / deleting levels from the dialog — v4.
- Audio loading/playback — v3 only creates the placeholder
  `public/data/audio/` directory; no format or code until assets exist.

## 3. Folder layout

Before → after:

```
public/assets/tilesets/Dirt_Platformer_Tiles/{platformertiles.png,
    tiles/, tiles.json, screenshots/, sources.txt}
levels/{above_ground.txt, below_ground.txt, README.md}
```
```
public/
  data/
    levels/    above_ground.txt  below_ground.txt  README.md
               manifest.json                       (generated)
    tilesets/  Dirt_Platformer_Tiles/{platformertiles.png, tiles/,
               tiles.json, screenshots/, sources.txt}
    audio/     .gitkeep                             (placeholder; future)
src/                                                (unchanged)
```

`public/` stays as Vite's static root; everything game-related sits under
`public/data/` and is served at `/data/...`. The slicing pipeline's output
path and `levels/README.md` move with the data; the script and all doc
cross-references update accordingly.

## 4. Asset resolution

Vite serves `public/` at the site root with **no configuration**. So:

- Tileset: `tileset.js` `ATLAS.src` changes from
  `/assets/tilesets/Dirt_Platformer_Tiles/platformertiles.png` to
  `/data/tilesets/Dirt_Platformer_Tiles/platformertiles.png`. One string;
  the renderer stays pure and otherwise untouched.
- Levels: fetched at runtime via `fetch('/data/levels/<id>.txt')`. Because
  `public/` is not directory-listable, the loader reads a generated
  `public/data/levels/manifest.json` (`[{ id, name, file }]`) to know what
  exists — the same generated-manifest pattern already used by `tiles.json`.

Manifest generation is a tiny script (sibling to the slicing script): scan
`public/data/levels/*.txt`, parse each `# name:`, write `manifest.json`. Run
manually when levels are added (documented in `data/levels/README.md`); a
build/predev hook is a possible later refinement (§9).

Rejected alternatives: a *true* root `data/` needs either `import.meta.glob`
(changes `tileset.js` to an asset import, more moving parts) or
`publicDir: 'data'` (loses the conventional `public/`); both add complexity
for no real gain over `public/data/`.

## 5. Level identity, drafts, and the dirty model

- **id** = filename stem (`above_ground`). The parsed `# name:` is the human
  label; ids are unique (filenames are), names may not be.
- **baseline** = the text last *loaded* into the buffer (bundled original, or
  a restored draft). **dirty** = `currentValue !== baseline`.
- **localStorage scheme** (namespace bumped so it never clashes with v1/v2):
  - `ld:v3:draft:<id>` — a saved draft for a level.
  - `ld:v3:lastOpen` — id to restore on startup.
  - One-time migration: if legacy `leveldesigner:v1` exists, import it as the
    draft of the default level, then remove the old key.
- Bundled `*.txt` are **read-only originals**. "Save" writes
  `ld:v3:draft:<id>` and resets baseline (clears dirty). "Revert to original"
  re-fetches the bundled text and deletes the draft. "Download .txt" emits the
  current buffer as a file (Blob + `<a download>`), the only path to a real
  on-disk file in v3.

## 6. UX — loader dialog

- **Trigger:** a "Levels" button in the status bar (and `Ctrl/Cmd+O`).
- **Dialog:** modal list of bundled levels; each row shows the label
  (`# name:`), id, a "● modified" marker when a draft exists, and highlights
  the current one. A per-row / current-buffer **Download** action is offered
  here too. Esc / backdrop click closes (treated as Cancel).
- **Switch flow:**
  - buffer clean → load selected immediately, re-run the pipeline.
  - buffer dirty → confirm popup: **Save draft & switch** /
    **Discard & switch** / **Cancel**. Cancel returns to the dialog, no
    state change.
- **Unload guard:** when dirty, a `beforeunload` handler prompts (best-effort;
  browsers show a generic message — acceptable).
- **Startup:** restore `ld:v3:lastOpen` (its draft if present, else the
  original); if none, load the first level in the manifest.

## 7. Architecture / modules

- **New `src/levels.js`** — load `manifest.json`, `fetch` level text, and
  manage draft/baseline/dirty/lastOpen. Side effects (storage, fetch) injected
  so it is unit-testable headless.
- **New `src/loaderDialog.js`** — builds the modal DOM, emits
  `select(id)` / `download(id)` / `cancel`; no storage/parsing knowledge.
- **New tiny `download` helper** — buffer text → `Blob` → `<a download>` as
  `<id>.txt`.
- **`src/main.js`** — replaces the single `STORAGE_KEY` block with
  `levels.js`; adds the trigger button, dirty tracking on `input`, and the
  confirm popup.
- **Unchanged & pure:** `level.js`, `validate.js`, `renderer.js`. `tileset.js`
  changes only its atlas URL (§4).

## 8. Milestones

| # | Deliverable |
|---|-------------|
| 1 | Move data to `public/data/`; `tileset.js` path swap; manifest generator script; build/tests green; slicing + doc paths updated |
| 2 | `levels.js` (manifest+fetch, draft/baseline/dirty, injectable deps) + unit tests; legacy-key migration |
| 3 | `loaderDialog.js` + trigger button; clean-buffer switch flow |
| 4 | Unsaved-changes confirm popup + `beforeunload` guard |
| 5 | Download `.txt` action (dialog + status bar) |
| 6 | Docs/paths swept (v1/v2 design refs, `data/levels/README.md`, §3 paths) |

## 9. Open questions

- **Manifest freshness** — manual regeneration script for v3 (accepted), or a
  `predev`/`prebuild` npm hook so it can't go stale? Recommend manual now,
  hook as a fast follow.
- **Migration** — keep importing the legacy `leveldesigner:v1` draft, or drop
  it (the sample is reproducible)? Recommend import-once for safety.
- **Reachability** — still no lint (carried from v2 §6); a browsable level
  list makes a broken level more visible. Promote into v3 or hold for v4?

## 10. Acceptance criteria

- No `public/assets/` or root `levels/`; all game data under
  `public/data/{levels,tilesets,audio}`; `npm run dev`/`build` work; the
  tileset renders unchanged; `npm test` green.
- `manifest.json` lists every bundled level; the loader shows them with
  current/modified indicators.
- Clean buffer → selecting a level switches and re-renders immediately.
- Dirty buffer → switching or unloading prompts; Cancel preserves state,
  Discard reverts to baseline, Save persists `ld:v3:draft:<id>` and clears
  dirty.
- "Download .txt" produces a file whose contents re-parse to the current
  buffer (round-trip clean).
- Restarting restores the last-open level and its draft when present; the
  legacy v1 key is migrated once and removed.

## 11. v4 candidates

File System Access API (or dev-server endpoint) write-back to
`public/data/levels/`; create/rename/delete levels from the dialog; audio
assets + loading; manifest build hook; reachability lint if not pulled into
v3.
