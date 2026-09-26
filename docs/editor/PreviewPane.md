# PreviewPane

`apps/editor/src/PreviewPane.ts` · class

The level preview: the `#preview` canvas the level is drawn on and the
`#overlay` canvas over it (drag marquee, viewport guide, solution paths).
It also owns Fit mode — scaling the canvas with CSS to fill its pane —
which works from the canvas's drawing size while editing and from a pinned
size during Play.

## Relationships
- owns a [PreviewGeometry](PreviewGeometry.md) (`geometry`)
- draws with render's `LevelRenderer`; creates [SolutionOverlay](SolutionOverlay.md)s
- reads and saves Fit mode through [Preferences](Preferences.md)
- used by [DragFillTool](DragFillTool.md), [PlayModeController](PlayModeController.md),
  [AgentController](AgentController.md) and [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `TILE` | static readonly | `24` — canvas pixels per cell in the editor |
| `HUD_HEIGHT` | static readonly | The HUD band's height (`LevelRenderer.HUD_HEIGHT_TILES × TILE`) |
| `HUD_PLACEHOLDER` | static readonly | `'HUD: score / status'`, drawn in the band while editing |
| `geometry` | readonly property | The [PreviewGeometry](PreviewGeometry.md) for this canvas |
| `canvas`, `overlay` | readonly properties | The two canvases |
| `fitToScreen` | get/set accessor | Fit mode (saved). Call `refit` to apply |
| `draw(level, tileset)` | method | Draw the level and HUD, reset the overlay, draw the viewport guide, re-fit |
| `clearOverlay()` | method | Clear the overlay canvas |
| `showMarquee(a, b)` | method | Highlight the cells between two [GridCell](GridCell.md)s |
| `solutionOverlay()` | method | A [SolutionOverlay](SolutionOverlay.md) for the overlay canvas, below the HUD |
| `applyFit()` | method | Edit-mode fit (does nothing during Play) |
| `applyPlayFit()` | method | Play-mode fit (does nothing while editing) |
| `refit()` | method | Both; used on window resize and the Fit button |
| `enterPlay(pin)` / `leavePlay()` | methods | Start / stop fitting from a [PlayPin](PlayPin.md) |

## Example
```ts
const preview = new PreviewPane(view.preview, view.overlay, view.canvasWrap, prefs);
preview.draw(Level.parse(text), tileset);
preview.fitToScreen = true;
preview.refit();
```

## Design notes
- **The canvas is an implementation detail.** Other classes ask for what
  they want (`showMarquee`, `solutionOverlay`, `clearOverlay`) rather than
  drawing on the canvas themselves.
- **State decides behaviour.** Whether Play is running is represented by
  the pinned size (`enterPlay` / `leavePlay`), so the two fit methods can
  each be called at any time and do the right thing.
- **Arithmetic delegated.** Everything that is plain maths is in
  [PreviewGeometry](PreviewGeometry.md), where it is unit-tested.
