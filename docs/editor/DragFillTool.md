# DragFillTool

`apps/editor/src/DragFillTool.ts` · class

The rectangle tool: drag on the preview to fill the cells under the marquee
with the legend's active glyph, or hold Shift to draw just the outline. A
drag that starts in the HUD band is ignored.

## Relationships
- listens on the overlay of a [PreviewPane](PreviewPane.md), and uses its
  [PreviewGeometry](PreviewGeometry.md) and `showMarquee`
- asks a [DragFillHost](DragFillHost.md) (the [EditorApp](EditorApp.md)) for the glyph and text, and commits through it
- edits the grid with level-format's `Rect`

## Members
| Member | Kind | Description |
|---|---|---|
| `new DragFillTool(preview, host)` | constructor | Start listening for pointer drags on the overlay |
| `apply(text, a, b, glyph, outline)` | static method | The text with rectangle a–b filled or outlined, or null if there is no grid |

## Example
```ts
DragFillTool.apply('.....\n.....', { cx: 1, cy: 0, inHud: false }, { cx: 3, cy: 1, inHud: false }, '#', false);
// '.###.\n.###.'
```

## Design notes
- **Pure core, thin shell.** `apply` is a static function of text in, text
  out; each changed row is written back on its original line, so the header
  and comments survive. The pointer handling around it is a few lines.
- **Depends on an interface.** The tool needs three things from the editor,
  declared as [DragFillHost](DragFillHost.md), not the whole `EditorApp`.
