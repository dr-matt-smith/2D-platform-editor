# Editor app

The level editor, served at `/apps/editor/` (`deno task dev`).

Author a level as ASCII text with a live tile-mapped preview and legend,
drag-to-fill painting, undo/redo, per-level drafts in `localStorage`, a
level library dialog, `.txt` download, **Play** (playtest in place, via
`@2d-platform/engine`) and **Test** (run the planning agent, via
`@2d-platform/agent`, and paint its solution paths).

The code is object-oriented, one class per file in `src/`; each class has
a page in [docs/editor/](../../docs/editor/README.md), which also has the
class diagram and a walkthrough of how a keystroke becomes a preview.

- `src/main.ts` — the entry point: `new EditorApp(root).start()`
- `src/EditorApp.ts` — the composition root: builds the components and runs the edit cycle
- `src/EditorView.ts`, `SourceEditor.ts`, `PreviewPane.ts`, `LegendPanel.ts`, `Toolbar.ts`, … — the page's components
- `src/PlayModeController.ts`, `AgentController.ts` — Play / Demo, and the Test button
- `src/ModalDialog.ts` and its subclasses (`LevelDialog`, `ConfirmDialog`, `PlaySettingsDialog`, `PasteLoadDialog`, `AgentDialog`) — the dialogs
- `src/LevelLibrary.ts`, `UndoHistory.ts`, `Preferences.ts`, `KeyValueStore.ts` — state and storage, unit-tested headless
- `src/*.test.ts` — unit tests (`deno task test`)
- `e2e/` — Playwright specs for everything that needs a real browser (`deno task test:e2e apps/editor`)

See [README_architecture.md](../../README_architecture.md) for how the
editor fits with the packages.
