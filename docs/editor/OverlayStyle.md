# OverlayStyle

`apps/editor/src/SolutionOverlay.ts` · interface

How [SolutionOverlay](SolutionOverlay.md)`.paint` draws one path.

## Relationships
- the optional `style` of [SolutionOverlay](SolutionOverlay.md)`.paint`

## Members
| Member | Kind | Description |
|---|---|---|
| `colour` | optional property | Path and pickup-marker colour (default yellow) |
| `alpha` | optional property | Opacity (default 1) |

## Example
```ts
overlay.paint(solution, { colour: SolutionOverlay.HUE_PALETTE[2], alpha: 0.35 });
```

## Design notes
An options object with defaults: leaving it out paints exactly as a single
solution always has.
