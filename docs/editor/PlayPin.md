# PlayPin

`apps/editor/src/PreviewGeometry.ts` · interface

The CSS size the preview canvas keeps during Play, before any Fit scaling:
the viewport (or whole world) at the editor's 24 px tiles, plus the HUD
band. The engine draws with 20 px tiles, so without the pin the canvas
would shrink on entering Play.

## Relationships
- computed by [PreviewGeometry](PreviewGeometry.md)`.playPin`; held by [PreviewPane](PreviewPane.md) during Play
- set by [PlayModeController](PlayModeController.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `cssW`, `cssH` | properties | CSS pixels |

## Example
```ts
preview.enterPlay(preview.geometry.playPin(level));
```

## Design notes
Plain data; its presence in [PreviewPane](PreviewPane.md) is what "Play is
running" means to the fit methods.
