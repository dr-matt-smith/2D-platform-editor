# Transcript — Version 6: Three Loadable Levels

A narrative record of the v6 phase: offering tutorial / below_ground /
above_ground in the loader, tutorial as default. Decisions and rationale.

## Reconciling the request with reality

The brief asked for three levels — "tutorial (currently named above ground at
runtime)", "underground", and "above ground (in /levels but not available to
load)". Checked against the actual state, two of those parentheticals were
wrong: `above_ground` and `below_ground` are both already in the manifest and
loadable; the runtime default is `above_ground`; and the only "tutorial" is a
hardcoded `SAMPLE` used purely as the offline fallback (not in `/levels`,
never shown in the loader). The design doc led with a "current state" section
stating this plainly rather than building on the mistaken premise.

## Two design calls

1. **Relabel, don't rename — then: don't even relabel.** v3 ties id =
   filename stem, and ids key localStorage drafts/`lastOpen`. The draft
   proposed relabelling `below_ground` → "Underground" via `# name:` (no id
   churn). The user edited the doc directly to say `below_ground` needs *no
   change at all*; the doc was reconciled to that — `below_ground` and
   `above_ground` are untouched, only `tutorial` is added.
2. **Ordering via an additive `# order:` directive.** Reused the established
   additive-header pattern (`name`/`size`/`theme`). It needs **no app code**:
   the parser already consumes any header directive, and only the manifest
   generator interprets `order`. Default = first manifest entry, so tutorial
   becomes default for free.

## Build (the lowest-risk version yet)

- **M1** — `tutorial.txt` promoted from `SAMPLE` (`# name: tutorial`,
  `# order: 1`); `# order: 2/3` on below/above. Parser-validated all three at
  0 errors; crucially `below_ground` kept `theme=cave` and both kept
  `name`/`size`, proving `# order:` is consumed as a directive, not misread
  as grid.
- **M2** — `gen-levels-manifest.mjs`: `readName` → `readHeader` (name +
  numeric order); stable sort `(order ?? 999, filename)`; manifest entry
  shape `{id,name,file}` unchanged. Regenerated → 3 entries, `list[0]` =
  `tutorial`. Dev-smoke confirmed order + default + 200.

No app code changed; no localStorage migration (ids stable); returning users'
`lastOpen` still resolves.

## Outcome

Tests stayed 52/52 (no src changes; `levels.test.js` injects its own
manifest), build clean throughout, every commit path-scoped. One known,
harmless asymmetry recorded: `serialize()` does not emit `# order:`, but it is
not on the app's load/save path, so bundled files keep theirs. The standing
no-automated-DOM-test gap (since v2) is unchanged; verification was
parser-validation + manifest assertion + dev smoke.
