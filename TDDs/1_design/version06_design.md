# 2D Level Designer — Version 6 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version05_design.md](version05_design.md)

## 1. Purpose

Offer **three** named levels in the loader dialog — `tutorial`,
`below_ground`, `above_ground` — with `tutorial` as the default on first run.

## 2. Current state (so the gap is precise)

- `public/data/levels/` has **two** files: `above_ground.txt` (sky platformer)
  and `below_ground.txt` (cave maze, `# theme: cave`).
- `manifest.json` lists both; **both are already loadable** via the v3 loader
  dialog. ("above ground not available to load" in the request is not
  accurate — it is the *default*.)
- Startup default = first manifest entry. `gen-levels-manifest.mjs` sorts by
  filename, so today that is `above_ground`.
- A hardcoded `SAMPLE` (`# name: tutorial-01`) lives in `main.js` purely as
  the **offline fallback** (manifest/level fetch failure). It is not in
  `/levels`, not in the manifest, and never shown in the loader. This is the
  only "tutorial" that exists today.

## 3. Reconciliation (interpreting the request)

The request maps to current artifacts as follows. **This mapping is the one
open decision — see §8; the rest of the doc assumes it.**

| Requested | Becomes | Action |
|----------|---------|--------|
| `tutorial` (the runtime default) | new `tutorial.txt` | promote the `SAMPLE` content to a real level; make it the default |
| `above_ground` | existing `above_ground.txt` | unchanged; already loadable, just no longer the default |

(`below_ground` - no change needed)

Rationale for leaving `below_ground` untouched: in v3 the **id = filename
stem** and ids key `localStorage` (`ld:v3:draft:<id>`, `ld:v3:lastOpen`). Any
rename/relabel churns ids or display; the brief does not need it, so
`below_ground` is left exactly as-is — **zero id churn, no migration, no
relabel**. It already appears in the loader (its `# name:` is the label).

## 4. Scope

### In scope

- Add `public/data/levels/tutorial.txt` (content = the current `tutorial-01`
  sample, `# name: tutorial`).
- `below_ground.txt` unchanged (no rename, no relabel).
- Deterministic load order so `tutorial` is first/default; the existing two
  follow.
- `SAMPLE` in `main.js` stays as the offline fallback (now redundant with a
  real tutorial, but still the only safety net if `/data` is unreachable).

### Out of scope

- Renaming files / changing ids (explicitly avoided, §3).
- New level *content* beyond promoting the existing sample.
- Loader UX changes (it is already manifest-driven and needs none).

## 5. Load order & default

`gen-levels-manifest.mjs` sorts by filename; alphabetically that is
`above_ground, below_ground, tutorial` — wrong order, and `above_ground`
would stay default. Options:

- **A (recommended): `# order:` header directive.** Additive, exactly like
  `name`/`size`/`theme` (v3/v2 precedent). The generator sorts by
  `(order ?? 999, filename)`. Set `tutorial: 1`, `below_ground: 2`,
  `above_ground: 3`. Startup default is already "first manifest entry", so it
  becomes `tutorial` for free. Unknown/absent `order` falls back to filename
  sort (back-compatible).
- B: hardcode a curated order array in the generator. Simpler but the order
  lives in build tooling, not with the level; brittle as levels are added.
- C: a separate `levels.config.json`. More moving parts than A.

A keeps ordering data with the level and reuses the established
additive-directive pattern; the parser already ignores unknown directives so
no `level.js` change is required (the generator reads `order`; the app only
consumes the manifest array order).

## 6. Architecture / impact

- **Files** — add `tutorial.txt`; edit `below_ground.txt` `# name:`; add
  `# order:` to all three.
- **`scripts/gen-levels-manifest.mjs`** — read `# order:`, sort by
  `(order, file)`. Manifest is regenerated automatically by the existing
  `predev`/`prebuild` hook; commit the regenerated `manifest.json`.
- **`level.js`** — no change. `order` is a header directive the parser
  already skips; only the generator interprets it. (Optionally parse it into
  `meta.order` later if the app ever needs it — not now.)
- **`levels.js` / `loaderDialog.js` / `main.js`** — no change. The loader is
  manifest-driven; startup already takes `list[0]` when there is no valid
  `lastOpen`. A returning user with `lastOpen` set keeps their level
  (unchanged, correct).
- **Docs** — `data/levels/README.md` (now three levels), v06 transcript.

## 7. Migration / back-compat

- No id changes ⇒ no `localStorage` migration needed; existing
  `below_ground` drafts and `lastOpen` keep working.
- A user whose `lastOpen` is `above_ground`/`below_ground` still resumes
  there; only a brand-new user (no `lastOpen`) gets `tutorial` as the
  default. This is the intended behaviour ("default", not "force").
- `manifest.json` must be regenerated (hook does this); stale manifest would
  omit `tutorial` — the `predev`/`prebuild` wiring from v3 prevents that.

## 8. Open questions

- **Mapping — RESOLVED.** Confirmed by the user: `tutorial` = promoted sample
  (new file, default); `below_ground` and `above_ground` both unchanged (no
  relabel, no rename). No `localStorage` migration.
- **Keep the `SAMPLE` constant?** Recommended yes (offline safety net); it
  could later be loaded *from* `tutorial.txt` at build time to avoid the
  duplicated text, but that adds a build step for little gain — defer.
- **Default policy.** "First manifest entry when no `lastOpen`" is assumed.
  Alternative: always force `tutorial` on load — rejected (annoys returning
  users); not recommended.

## 9. Milestones

| # | Deliverable |
|---|-------------|
| 1 | Add `tutorial.txt` (from `SAMPLE`, `# name: tutorial`); add `# order:` to the three levels |
| 2 | `gen-levels-manifest.mjs` honours `# order:`; regenerate + commit `manifest.json`; dev-smoke the 3-entry loader + default |
| 3 | Docs: `data/levels/README.md` (three levels) + v06 transcript; mark plan delivered |

## 10. Acceptance criteria

- The loader dialog lists exactly three — `tutorial`, `below_ground`,
  `above_ground` (their `# name:` labels) — with `tutorial` first/default.
- A fresh profile (no `lastOpen`) opens on `tutorial`.
- A returning user's `lastOpen` (incl. `below_ground`) still resolves and
  loads — no lost drafts, no migration.
- `npm test` green, `npm run build` clean, `manifest.json` has three entries
  via the hook (not hand-edited).

## 11. v7 candidates

Per-tile variant randomisation; flood fill + line tool; reachability lint;
play-test runtime (long-standing, v2 §6); level create/rename/delete from the
dialog (would finally make id-rename + migration worthwhile).
