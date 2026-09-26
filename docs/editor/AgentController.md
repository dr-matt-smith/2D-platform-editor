# AgentController

`apps/editor/src/AgentController.ts` · class

The Test button: ask the planning agent whether the level can be solved,
show the answer in an [AgentDialog](AgentDialog.md), draw the solution
paths on the preview, and pass a chosen solution to Play as a Demo. This is
where the agent meets the engine: the agent never imports the engine, so it
is handed the engine's physics adapter (`jsAdapter`) here.

## Relationships
- opens an [AgentDialog](AgentDialog.md), giving it a `RunAgent` that calls agent's `LevelTester` with engine's `jsAdapter`
- paints with [PreviewPane](PreviewPane.md)`.solutionOverlay()` ([SolutionOverlay](SolutionOverlay.md))
- starts a Demo through [PlayModeController](PlayModeController.md)
- reads the legend and tileset from [ActiveTileset](ActiveTileset.md); pins the [Toolbar](Toolbar.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new AgentController(text, tilesets, preview, toolbar, playMode, prefs)` | constructor | |
| `open()` | method | Test the level as it is now |

## Example
```ts
toolbarActions.test = () => agent.open();
```

## Design notes
- **The seam between packages.** Keeping the agent–engine wiring in one
  small class makes the architecture rule ("the agent never imports the
  engine") visible in the code.
- **testmode.** While the dialog is open the body has `testmode`, which
  hides the legend; the preview re-fits on the next animation frame, once
  the layout has changed.
