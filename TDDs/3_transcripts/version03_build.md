# Transcript — Version 3: Data Consolidation & Level Loader

A narrative record of the v3 phase: tidying game data into one folder and
adding a level loader. Decisions and rationale, in order.

## The folder decision

The brief asked for a *top-level* `data/` folder. Designing it surfaced a
conflict: Vite only statically serves its `publicDir`, so a true root `data/`
needs either `import.meta.glob` (changes `tileset.js` to an asset import) or
`publicDir: 'data'` (loses the conventional `public/`). The user proposed
`public/data/` instead — which is the right call: Vite serves it at `/data/`
with zero config, the tileset stays a plain URL swap, and the only cost is a
generated `manifest.json` (the same pattern `tiles.json` already uses).

## Save semantics

A static web app cannot write back to `public/data/levels/*.txt`. Rather than
let a "Save" button imply something false, the model was made explicit: Save =
a localStorage draft; Revert = re-fetch the original; and a **Download .txt**
action — promoted from a v4 idea into v3 scope — is the only real on-disk
output. Real write-back (File System Access API) stays v4.

## Manifest freshness

Left as an open question first (manual script vs. build hook); the user folded
the hook into milestone 1, so the generator is wired as `predev`/`prebuild`
and cannot go stale.

## Implementation

Six milestones, one commit each, tests green throughout:

1. `git mv` data into `public/data/{levels,tilesets}`; `tileset.js` URL swap;
   Node manifest generator wired as `predev`/`prebuild`. The riskiest step
   (bulk move + only runtime-affecting change), so it was smoke-tested —
   `/data/...` served `200` — before anything built on it.
2. `levels.js` with injected `fetch`/`storage` (headless-testable):
   draft/baseline/dirty, idempotent legacy-key migration. Later gained a
   baseline-safe `peek` for the dialog's per-row download.
3. `loaderDialog.js` modal + a Levels button / `Ctrl/Cmd+O`; clean-buffer
   switching and startup restore replaced the v1 single-key block.
4. Dirty tracking, an unsaved-changes confirm popup (Save / Discard /
   Cancel→back to list), and a best-effort `beforeunload` guard.
5. `download.js` — pure `toLevelFile` (sanitised name, trailing newline
   stripped so it re-parses cleanly) unit-tested; DOM click path by smoke.

## An incident worth recording

During milestone 6 the `TDDs/3_transcripts/` directory was found missing.
Cause: an earlier `git add -A` (commit `4fa1277`, "Add v3 implementation
plan") had staged an unrelated working-tree deletion of the transcripts. They
were recovered byte-identical from history (`git checkout 15188a2 -- …`).
Takeaway, applied for the rest of v3: prefer path-scoped `git add` for doc
commits and check `git status` before any `-A`.

## Outcome

Tests 20 → 29 (`levels` + `download` suites added), clean build, `/data/*`
served in dev and copied to `dist/`. DOM-heavy modules kept their logic in
pure, tested helpers; the dialog/popup interactions themselves are
dev-smoke-verified, not browser-automated (still unscoped, as in v2).
