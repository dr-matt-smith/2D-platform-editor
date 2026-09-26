# EditorApp

`apps/editor/src/EditorApp.ts` · class

The level editor as a whole. It is the *composition root*: its constructor
builds every component, gives each the collaborators it needs, and wires
their events to its own methods. It also owns the state they share — which
level is open (`currentId`) — and the edit cycle around it: open a level,
edit, undo, and save a draft or discard it when switching away.

## Relationships
- builds and owns [EditorView](EditorView.md), [SourceEditor](SourceEditor.md),
  [PreviewPane](PreviewPane.md), [LegendPanel](LegendPanel.md),
  [ProblemsPanel](ProblemsPanel.md), [Toolbar](Toolbar.md),
  [TilesetMenu](TilesetMenu.md), [LevelMenu](LevelMenu.md),
  [ThemeController](ThemeController.md), [PlayModeController](PlayModeController.md),
  [AgentController](AgentController.md), [DragFillTool](DragFillTool.md),
  [ActiveTileset](ActiveTileset.md), [LevelLibrary](LevelLibrary.md),
  [UndoHistory](UndoHistory.md) and [Preferences](Preferences.md)
- attaches the [PaneSplitter](PaneSplitter.md) and [ProblemsSplitter](ProblemsSplitter.md)
  and the [KeyboardShortcuts](KeyboardShortcuts.md)
- opens [LevelDialog](LevelDialog.md), [ConfirmDialog](ConfirmDialog.md),
  [PlaySettingsDialog](PlaySettingsDialog.md) and [PasteLoadDialog](PasteLoadDialog.md);
  saves through [LevelFile](LevelFile.md)
- satisfies [SourceEditorEvents](SourceEditorEvents.md), [LegendPanelEvents](LegendPanelEvents.md),
  [ToolbarActions](ToolbarActions.md), [DragFillHost](DragFillHost.md) and
  [PlayModeHost](PlayModeHost.md) with object literals
- created by `main.ts`

## Members
| Member | Kind | Description |
|---|---|---|
| `SAMPLE` | static readonly | The level shown when the library cannot be reached |
| `new EditorApp(root)` | constructor | Write the page into `root` and build every component |
| `start()` | async method | Load the library and open the last-used level (else the first, else `SAMPLE`) |
| `repaint()` | private method | Validate and draw the buffer (skipped during Play) |
| `refresh()` | private async method | Sync the tileset to the buffer's `# tileset:`, then repaint |
| `openBuffer(text, id)` | private method | Show a freshly opened level, with a new undo timeline |
| `commitEdit(text)` | private method | Replace the buffer as one undo step |
| `restore(text)` | private method | Show a state from the undo history |
| `editDirective(edit)` | private method | Rewrite a header line through level-format's `LevelText` |
| `guardUnsaved(proceed, onCancel?)` | private method | Offer save / discard / cancel before leaving a changed level |
| `switchTo(id)`, `chooseLevel(id)`, `newLevel(spec)` | private methods | The ways to open another level |
| `downloadLevel(id)` | private async method | Save a level as a `.txt` |
| `openLevelDialog()`, `openPasteLoad()`, `openPlaySettings()` | private methods | Open a dialog |

## Example
```ts
// main.ts
import './style.css';
import { EditorApp } from './EditorApp.ts';

void new EditorApp(document.querySelector<HTMLElement>('#app')!).start();
```

## Design notes
- **Composition root.** Only this class knows the concrete components.
  Everything else receives what it needs through its constructor
  (dependency injection by hand), so no component reaches for another or
  for a global. Reading the constructor top to bottom shows the whole
  editor's structure.
- **Mediator.** Components do not call one another; they report events
  (`onSettle`, `toggleFit`, `onBackgroundImage`…) and this class decides
  what happens. That keeps each component's job small — the
  [Toolbar](Toolbar.md) knows nothing about undo, the
  [LegendPanel](LegendPanel.md) nothing about level text.
- **Constructor builds, `start` loads.** Construction is synchronous and
  cannot fail; everything that fetches is in `start()`, which falls back
  to `SAMPLE` if the library is unreachable.
- **One word for each change.** `commitEdit` (a new undo step, repaint now),
  `restore` (an undo/redo state, may change tileset), `openBuffer` (a new
  level, new timeline) and `refresh` (re-sync the tileset) are the only
  ways the buffer changes, which is what keeps undo, the dirty marker and
  the preview consistent.
