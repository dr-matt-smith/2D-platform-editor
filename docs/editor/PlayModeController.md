# PlayModeController

`apps/editor/src/PlayModeController.ts` · class

Play and Demo: playtest the level in place on the preview canvas with the
engine's `Playtest`. Play reads the keyboard; Demo replays an agent
recording and leaves by itself 1.5 s after the run is won or lost. Esc or
the Exit button return to editing. It owns the editor's
[EditorMode](EditorMode.md).

## Relationships
- launches engine's `Playtest` on [PreviewPane](PreviewPane.md)`.canvas`, with the
  legend and tileset from [ActiveTileset](ActiveTileset.md)
- pins the canvas through [PreviewPane](PreviewPane.md) (a [PlayPin](PlayPin.md)) and the [Toolbar](Toolbar.md)
- reports a refused launch on the [ProblemsPanel](ProblemsPanel.md)
- asks a [PlayModeHost](PlayModeHost.md) (the [EditorApp](EditorApp.md)) for the text and issues, and to repaint
- started with a recording by [AgentController](AgentController.md) (Demo)

## Members
| Member | Kind | Description |
|---|---|---|
| `new PlayModeController(preview, tilesets, toolbar, problems, host)` | constructor | |
| `mode` | get accessor | `Edit`, `Play` or `Demo` |
| `start(recording?)` | method | Play the live buffer (Demo with a recording); if refused, flash the reasons |
| `restart()` | method | Restart the running playtest |
| `exit()` | method | Stop, restore the page and repaint |

## Example
```ts
playMode.start();                 // Ctrl/Cmd+Enter
playMode.start(solution.recording); // Demo
playMode.mode === EditorMode.Demo;
```

## Design notes
- **A small state machine.** `start` and `exit` are the only transitions;
  each guards on the current mode, so a repeated shortcut cannot start two
  games or exit twice.
- **Body classes as the view.** Entering Play adds `playmode` (and
  `demomode`); the stylesheet swaps the toolbar and hides the legend.
- **The engine does the playing.** This class only decides *when* to play
  and restores the editor afterwards.
