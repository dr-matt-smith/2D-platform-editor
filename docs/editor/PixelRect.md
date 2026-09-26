# PixelRect

`apps/editor/src/PreviewGeometry.ts` · interface

A rectangle in canvas pixels.

## Relationships
- returned by [PreviewGeometry](PreviewGeometry.md) (`cellRect`, `viewportRect`); drawn by [PreviewPane](PreviewPane.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `x`, `y` | properties | Top-left corner |
| `w`, `h` | properties | Size |

## Example
```ts
const r = geometry.cellRect(a, b);
ctx.fillRect(r.x, r.y, r.w, r.h);
```

## Design notes
A plain data shape between the maths and the drawing.
