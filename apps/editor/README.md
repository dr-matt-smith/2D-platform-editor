# Editor app

The level editor, served at `/apps/editor/` (`deno task dev`).

Author a level as ASCII text with a live tile-mapped preview and legend,
undo/redo, per-level drafts in `localStorage`, a level library dialog,
`.txt` download, **Play** (playtest in place, via `@2d-platform/engine`)
and **Test** (run the planning agent, via `@2d-platform/agent`, and paint
its solution paths with `overlay.ts`).

- `src/main.ts` — wires the page together (buffer, preview, legend, toolbar, play/test modes)
- `src/levels.ts` — the level library: bundled manifest + drafts + pasted local levels
- `src/loaderDialog.ts`, `src/agentDialog.ts` — the modal dialogs
- `src/history.ts`, `src/splitter.ts`, `src/download.ts`, `src/summarise.ts`, `src/escapeHtml.ts` — small UI helpers
- `e2e/` — Playwright specs for everything that needs a real browser

See [README_architecture.md](../../README_architecture.md).
