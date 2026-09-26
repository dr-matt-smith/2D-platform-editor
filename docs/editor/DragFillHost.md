# DragFillHost

`apps/editor/src/DragFillTool.ts` · interface

What the [DragFillTool](DragFillTool.md) needs from the editor.

## Relationships
- passed to [DragFillTool](DragFillTool.md); implemented by [EditorApp](EditorApp.md) with an object literal

## Members
| Member | Kind | Description |
|---|---|---|
| `glyph()` | method | The glyph to paint with (the [LegendPanel](LegendPanel.md)'s active glyph) |
| `text()` | method | The current level text |
| `commit(text)` | method | Replace the text as one undoable step |

## Example
```ts
new DragFillTool(preview, {
  glyph: () => legend.glyph,
  text: () => source.text,
  commit: (text) => commitEdit(text),
});
```

## Design notes
The interface segregation principle: the tool gets the three operations it
uses, nothing more, so it can be tested or reused with any host.
