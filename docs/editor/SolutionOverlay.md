# SolutionOverlay

`apps/editor/src/SolutionOverlay.ts` · class

Paints the agent's solution paths on a canvas: a line from the start
through each planned step (jumps as arcs), with markers — S at the start,
1, 2, 3… at each pickup in visit order, E at the exit. With several
solutions, each gets its own hue and the focused one is drawn solid on top.

## Relationships
- created by [PreviewPane](PreviewPane.md)`.solutionOverlay()` for the `#overlay` canvas
- paints [OverlaySolution](OverlaySolution.md)s (the agent's `Solution` fits) in an [OverlayStyle](OverlayStyle.md)
- used by [AgentController](AgentController.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `HUE_PALETTE` | static readonly | Five hues, one per solution; the first is the single-path yellow |
| `DIMMED_ALPHA` | static readonly | `0.35`, for the paths that are not focused |
| `new SolutionOverlay(ctx, tile, yOffset = 0)` | constructor | Bind to a context and grid; `yOffset` skips the HUD band |
| `paint(solution, style?)` | method | One path and its markers |
| `paintAll(solutions, focusedIdx)` | method | Every path: the others dimmed, then the focused one solid |
| `arc(x0, y0, x1, y1, tile, samples?)` | static method | Points along a jump (a quadratic Bézier a tile above the higher end) |

## Example
```ts
const overlay = new SolutionOverlay(ctx, 24, 24);
overlay.paintAll(result.solutions, 0);
```

## Design notes
- **An object bound to its context.** The canvas, tile size and offset are
  given once, so each call says only *what* to paint.
- **Constants with names.** The palette and colours are static members,
  visible to tests (and to the end-to-end spec that checks the palette).
- **Structural typing.** It asks for an [OverlaySolution](OverlaySolution.md)
  — just the `plan` fields it reads — so tests pass small literals.
