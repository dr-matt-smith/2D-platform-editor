# LegendPanelEvents

`apps/editor/src/LegendPanel.ts` · interface

What the [LegendPanel](LegendPanel.md) asks of, and reports to, the editor.

## Relationships
- passed to [LegendPanel](LegendPanel.md); implemented by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `backgroundImage()` | method | The level's current `# background-image:` id (`''` for none) |
| `onBackgroundImage(id)` | method | The user picked a background image (`null` for none) |
| `onLayoutChange()` | method | The panel moved or was minimised; the preview should re-fit |

## Example
See [LegendPanel](LegendPanel.md).

## Design notes
One query and two events: the panel stays ignorant of level text and of
the preview.
