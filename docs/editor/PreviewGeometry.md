# PreviewGeometry

`apps/editor/src/PreviewGeometry.ts` · class

Where things are on the preview canvas. The canvas has `tile` pixels per
cell and a HUD band `hudHeight` pixels tall across the top, so every
conversion between pointer, cell and pixel must add or remove that band.
Pure arithmetic, so it is unit-tested without a browser.

## Relationships
- owned by [PreviewPane](PreviewPane.md) (`geometry`)
- returns [GridCell](GridCell.md), [PixelRect](PixelRect.md) and [PlayPin](PlayPin.md)
- used by [DragFillTool](DragFillTool.md) and [PlayModeController](PlayModeController.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new PreviewGeometry(tile, hudHeight)` | constructor | |
| `tile`, `hudHeight` | readonly properties | |
| `cellAt(clientX, clientY, box, width, height)` | method | The cell under the pointer, undoing CSS scaling; clamped to the level, `inHud` when above it |
| `cellRect(a, b)` | method | The pixel rectangle covering two corner cells |
| `viewportRect(level)` | method | Where the Play camera starts for a `# viewport:` level (centred on `P`, clamped), or null |
| `playPin(level)` | method | The canvas's CSS size during Play |
| `fitScale(availW, availH, w, h)` | static method | The aspect-preserving scale that fits a box |

## Example
```ts
const geo = new PreviewGeometry(24, 24);
const cell = geo.cellAt(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
if (!cell.inHud) paint(cell.cx, cell.cy);
```

## Design notes
**Separate the maths from the DOM.** Hit-testing was the part most easily
broken (by the HUD band, by Fit-mode scaling); as a value object with no
DOM access it has its own tests, and [PreviewPane](PreviewPane.md) stays
about canvases.
