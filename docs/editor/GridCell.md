# GridCell

`apps/editor/src/PreviewGeometry.ts` · interface

A grid cell under the pointer, clamped to the level.

## Relationships
- returned by [PreviewGeometry](PreviewGeometry.md)`.cellAt`; used by [DragFillTool](DragFillTool.md)
  and [PreviewPane](PreviewPane.md)`.showMarquee`

## Members
| Member | Kind | Description |
|---|---|---|
| `cx`, `cy` | properties | 0-based column and row |
| `inHud` | property | The pointer is in the HUD band above the level (`cy` is then 0) |

## Example
```ts
{ cx: 3, cy: 2, inHud: false }
```

## Design notes
Carrying `inHud` with the cell lets the tool refuse HUD drags without
redoing the arithmetic.
